# Service boundaries
- Hy-Tek services delegate to pure parsers in src/lib/hytek; never duplicate fixed-width mappings or perform database writes during file reading.