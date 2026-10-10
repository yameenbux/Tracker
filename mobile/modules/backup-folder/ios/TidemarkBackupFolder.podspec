Pod::Spec.new do |s|
  s.name           = 'TidemarkBackupFolder'
  s.version        = '1.0.0'
  s.summary        = 'Automatic backups to a folder the person picked once'
  s.description    = 'Keeps access to one folder chosen in the Files picker and writes Tidemark backups into it.'
  s.author         = ''
  s.homepage       = 'https://tidemark.ysbdesigns.uk'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = "**/*.{h,m,swift}"
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
