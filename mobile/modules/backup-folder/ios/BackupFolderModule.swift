// Automatic backups into one folder the person picked in the Files picker (on this iPhone or in iCloud Drive).
// iOS only lets an app into a folder outside its sandbox when the person picks it, so the pick is kept as a
// security-scoped bookmark: on later launches the bookmark reopens the same folder without asking again.
// Everything here is plain files in that folder; Tidemark never talks to iCloud itself.
import ExpoModulesCore
import UIKit
import UniformTypeIdentifiers

private let bookmarkKey = "tidemark.backupFolder.bookmark"
private let probeName = ".tidemark-write-check"

internal final class NoFolderException: Exception {
  override var reason: String { "No backup folder has been chosen" }
}
internal final class FolderUnavailableException: Exception {
  override var reason: String { "The backup folder can't be reached. It may have been moved, renamed or deleted, or iCloud Drive may be off." }
}
internal final class BadNameException: Exception {
  override var reason: String { "Not a backup file name Tidemark writes" }
}
internal final class PickingInProgressException: Exception {
  override var reason: String { "A folder is already being picked" }
}
internal final class MissingViewControllerException: Exception {
  override var reason: String { "Could not find the current view controller" }
}
internal final class FileFailedException: GenericException<String> {
  override var reason: String { param }
}

public class BackupFolderModule: Module {
  private var picking: (promise: Promise, delegate: FolderPickingDelegate)?

  public func definition() -> ModuleDefinition {
    Name("TidemarkBackupFolder")

    /// Whether a folder is set, and its name if it can still be reached (nil name: set but gone).
    Function("status") { () -> [String: Any] in
      guard UserDefaults.standard.data(forKey: bookmarkKey) != nil else { return ["set": false] }
      guard let name = (try? self.resolveFolder())?.lastPathComponent else { return ["set": true] }
      return ["set": true, "name": name]
    }

    /// Shows the Files folder picker. Resolves to the folder's name, or nil if the person cancelled.
    AsyncFunction("pick") { (promise: Promise) in
      if self.picking != nil { throw PickingInProgressException() }
      guard let vc = self.appContext?.utilities?.currentViewController() else { throw MissingViewControllerException() }
      let picker = UIDocumentPickerViewController(forOpeningContentTypes: [UTType.folder])
      let delegate = FolderPickingDelegate(onPick: { [weak self] url in self?.didPick(url) },
                                           onCancel: { [weak self] in self?.finishPicking { $0.resolve(nil) } })
      picker.delegate = delegate
      picker.presentationController?.delegate = delegate
      picker.allowsMultipleSelection = false
      self.picking = (promise, delegate)
      vc.present(picker, animated: true)
    }.runOnQueue(.main)

    /// Stops using the folder. Files already in it stay where they are.
    Function("forget") {
      UserDefaults.standard.removeObject(forKey: bookmarkKey)
    }

    /// Writes one backup file (replacing one of the same name), atomically and in step with iCloud Drive.
    AsyncFunction("write") { (name: String, text: String) in
      try self.check(name)
      try self.withFolder { folder in
        try self.coordinatedWrite(Data(text.utf8), to: folder.appendingPathComponent(name))
      }
    }

    /// File names in the folder. iCloud files that aren't downloaded show up under their real names.
    AsyncFunction("list") { () -> [String] in
      try self.withFolder { folder in
        let items: [URL]
        do { items = try FileManager.default.contentsOfDirectory(at: folder, includingPropertiesForKeys: nil, options: []) }
        catch { throw FileFailedException(error.localizedDescription) }
        var names = Set<String>()
        for item in items {
          let n = item.lastPathComponent
          if n.hasPrefix("."), n.hasSuffix(".icloud") { names.insert(String(n.dropFirst().dropLast(7))) }   // ".x.txt.icloud"
          else if !n.hasPrefix(".") { names.insert(n) }
        }
        return Array(names)
      }
    }

    /// Deletes one of Tidemark's own backup files (only names Tidemark writes are accepted).
    AsyncFunction("remove") { (name: String) in
      try self.check(name)
      try self.withFolder { folder in
        var target = folder.appendingPathComponent(name)
        if !FileManager.default.fileExists(atPath: target.path) {
          let placeholder = folder.appendingPathComponent("." + name + ".icloud")
          guard FileManager.default.fileExists(atPath: placeholder.path) else { return }
          target = placeholder
        }
        try self.coordinatedDelete(target)
      }
    }
  }

  // MARK: picking

  private func finishPicking(_ settle: (Promise) -> Void) {
    guard let p = picking else { return }
    picking = nil
    settle(p.promise)
  }

  private func didPick(_ url: URL) {
    let accessing = url.startAccessingSecurityScopedResource()
    defer { if accessing { url.stopAccessingSecurityScopedResource() } }
    do {
      // Prove a file can really be written there before trusting the folder (some providers are read-only)
      try coordinatedWrite(Data("ok".utf8), to: url.appendingPathComponent(probeName))
      try? coordinatedDelete(url.appendingPathComponent(probeName))
      let bookmark = try url.bookmarkData(options: .minimalBookmark, includingResourceValuesForKeys: nil, relativeTo: nil)
      UserDefaults.standard.set(bookmark, forKey: bookmarkKey)
      finishPicking { $0.resolve(url.lastPathComponent) }
    } catch {
      finishPicking { $0.reject(FileFailedException("Tidemark can't save files in that folder. Pick another one.")) }
    }
  }

  // MARK: folder access

  private func resolveFolder() throws -> URL {
    guard let data = UserDefaults.standard.data(forKey: bookmarkKey) else { throw NoFolderException() }
    var stale = false
    let url: URL
    do { url = try URL(resolvingBookmarkData: data, options: [], relativeTo: nil, bookmarkDataIsStale: &stale) }
    catch { throw FolderUnavailableException() }
    if stale {
      // The folder moved or was renamed: still reachable, so save a fresh bookmark for next time
      let accessing = url.startAccessingSecurityScopedResource()
      defer { if accessing { url.stopAccessingSecurityScopedResource() } }
      if let fresh = try? url.bookmarkData(options: .minimalBookmark, includingResourceValuesForKeys: nil, relativeTo: nil) {
        UserDefaults.standard.set(fresh, forKey: bookmarkKey)
      }
    }
    return url
  }

  private func withFolder<T>(_ body: (URL) throws -> T) throws -> T {
    let folder = try resolveFolder()
    let accessing = folder.startAccessingSecurityScopedResource()
    defer { if accessing { folder.stopAccessingSecurityScopedResource() } }
    var isDir: ObjCBool = false
    // An iCloud folder can exist without being on the phone yet; only a folder that's gone everywhere fails here
    if !accessing && !FileManager.default.fileExists(atPath: folder.path, isDirectory: &isDir) { throw FolderUnavailableException() }
    return try body(folder)
  }

  private func check(_ name: String) throws {
    let ok = name.hasPrefix("Tidemark backup ") && name.hasSuffix(".txt") && name.count < 80
      && !name.contains("/") && !name.contains("..")
    if !ok { throw BadNameException() }
  }

  private func coordinatedWrite(_ data: Data, to file: URL) throws {
    var coordError: NSError?
    var writeError: Error?
    NSFileCoordinator(filePresenter: nil).coordinate(writingItemAt: file, options: .forReplacing, error: &coordError) { url in
      do { try data.write(to: url, options: .atomic) } catch { writeError = error }
    }
    if let e = coordError ?? writeError { throw FileFailedException(e.localizedDescription) }
  }

  private func coordinatedDelete(_ file: URL) throws {
    var coordError: NSError?
    var deleteError: Error?
    NSFileCoordinator(filePresenter: nil).coordinate(writingItemAt: file, options: .forDeleting, error: &coordError) { url in
      do { try FileManager.default.removeItem(at: url) } catch { deleteError = error }
    }
    if let e = coordError ?? deleteError { throw FileFailedException(e.localizedDescription) }
  }
}

internal final class FolderPickingDelegate: NSObject, UIDocumentPickerDelegate, UIAdaptivePresentationControllerDelegate {
  private let onPick: (URL) -> Void
  private let onCancel: () -> Void

  init(onPick: @escaping (URL) -> Void, onCancel: @escaping () -> Void) {
    self.onPick = onPick
    self.onCancel = onCancel
  }

  func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
    if let url = urls.first { onPick(url) } else { onCancel() }
  }

  func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) { onCancel() }

  func presentationControllerDidDismiss(_ presentationController: UIPresentationController) { onCancel() }
}
