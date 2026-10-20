# Usage: patch-ats.py <in.ipa> <out.ipa>. Rewrites the IPA entry by entry so only Info.plist changes.
import plistlib
import sys
import zipfile

src = zipfile.ZipFile(sys.argv[1])
dst = zipfile.ZipFile(sys.argv[2], 'w', zipfile.ZIP_DEFLATED)

for info in src.infolist():
    data = src.read(info.filename)

    if info.filename == 'Payload/Discord.app/Info.plist':
        plist = plistlib.loads(data)
        plist['NSAppTransportSecurity'] = {'NSAllowsArbitraryLoads': True}
        data = plistlib.dumps(plist, fmt=plistlib.FMT_BINARY)

    dst.writestr(info, data)

dst.close()
print('patched', sys.argv[2])
