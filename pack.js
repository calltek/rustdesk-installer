const exec = require('child_process').execSync

exec('node --experimental-sea-config app.json')

exec(`node -e \"require('fs').copyFileSync(process.execPath, 'support.exe')\"`)

exec('signtool remove /s support.exe')

exec(
    `npx postject support.exe NODE_SEA_BLOB app.blob --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2`
)

exec(`signtool sign /fd SHA256 support.exe`)
