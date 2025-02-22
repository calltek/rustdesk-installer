import dotenv from 'dotenv'
import fs from 'fs'
import child from 'child_process'
import copypaste from 'copy-paste'
import chalk from 'chalk'

dotenv.config()

class RustdeskWindows {
    id = 0
    config = ''
    password = ''
    installService = true
    brandName = 'Rustdesk'
    binaryUrl = ''
    verbose = false

    private tmpPath = '/tmp'
    private binPath = '/"Program Files/RustDesk/rustdesk.exe"'

    constructor(config?: string, password?: string) {
        if (!process.env.windir) {
            throw new Error('This script is only for Windows OS')
        }

        const driveLetter = process.env.windir.split('\\')[0]
        this.tmpPath = `${driveLetter}${this.tmpPath}`
        this.binPath = `${driveLetter}${this.binPath}`

        this.binaryUrl = process.env.RUSTDESK_BINARY_URL || ''
        if (!this.binaryUrl) {
            throw new Error('Rustdesk Binary URL is required')
        }

        const defaultConfig = process.env.RUSTDESK_CONFIG || ''
        if (config) {
            this.config = config
        } else if (defaultConfig) {
            this.config = defaultConfig
        } else {
            throw new Error('Rustdesk Config is required')
        }

        const defaultPassword = process.env.RUSTDESK_DEFAULT_PASSWORD || ''
        if (password) {
            this.password = password
        } else if (defaultPassword) {
            this.password = defaultPassword
        }

        const installService = process.env.RUSTDESK_INSTALL_SERVICE === 'false' ? false : true
        this.installService = installService

        const brandName = process.env.RUSTDESK_BRAND_NAME || ''
        if (brandName) this.brandName = brandName

        this.verbose = process.env.RUSTDESK_VERBOSE === 'true' ? true : false
    }

    private async sleep(seconds: number) {
        return new Promise((resolve) => setTimeout(resolve, seconds * 1000))
    }

    clearLastLine() {
        process.stdout.moveCursor(0, -1) // up one line
        process.stdout.clearLine(1) // from cursor to end
    }

    private async log(level: 'info' | 'error' | 'debug', message: string, error?: any) {
        if (!this.verbose && level === 'debug') return

        if (this.verbose) {
            message = `[${level.toUpperCase()}] ${message}`
        }

        if (level === 'error') {
            console.error(message, error)
        } else if (level === 'info') {
            console.log(message)
        } else {
            console.log(message)
        }
    }

    async init() {
        try {
            this.renderArt()

            this.log('info', 'Installing. Please be patient...')

            await this.downloadRelease()
            await this.installBin()

            await this.getId()
            await this.setConfig()
            await this.setPassword()

            this.run()
            this.print()
        } catch (error) {
            this.log('error', 'Unexpected error', error)
        }
    }

    private renderArt() {
        const base64 = process.env.RUSTDESK_ASCII_LOGO || ''
        if (!base64) return

        const header = atob(base64)
        const version = process.env.npm_package_version || '1.0.0'

        const content = `${header}\n\n========================================\n= RUSTDESK INSTALLER BY ${this.brandName.toUpperCase()}: ${version}\n========================================\n`

        console.log(content)
    }

    print() {
        const id = this.id
        const password = this.password
        const clipboard = `ID: ${id}\nContraseña: ${password}`

        if (!this.verbose) this.clearLastLine()

        this.log('info', `ID: ${chalk.green(id)}`)
        this.log('info', `Password: ${chalk.yellow(password)}`)

        copypaste.copy(clipboard)
    }

    downloadRelease(): Promise<void> {
        return new Promise(async (resolve, reject) => {
            try {
                this.log('debug', 'Creating tmp folder...')

                if (!fs.existsSync(this.tmpPath)) {
                    fs.mkdirSync(this.tmpPath)
                }

                this.log('debug', `Downloading release file from ${this.binaryUrl}`)
                const file = await fetch(this.binaryUrl)
                const buffer = await file.arrayBuffer()

                // Get filename from url
                const filename = this.binaryUrl.split('/').pop()

                // Store in tmp folder
                fs.writeFileSync(this.tmpPath + '/' + filename, Buffer.from(buffer))

                resolve()
            } catch (error) {
                this.log(
                    'error',
                    'An error occurred while downloading the latest version of Rustdesk',
                    error
                )
            }
        })
    }

    installBin(): Promise<void> {
        return new Promise(async (resolve, reject) => {
            try {
                this.log('debug', 'Installing rustdesk...')

                // Get filename from url
                const filename = this.binaryUrl.split('/').pop()

                child.exec(
                    `${this.tmpPath}/${filename} --silent-install`,
                    (err: any, stdout: any, stderr: any) => {
                        if (err || stderr) throw err
                    }
                )

                const delay = process.env.RUSTDESK_INSTALL_DELAY || '20'
                await this.sleep(parseInt(delay))

                resolve()
            } catch (error) {
                reject(error)
            }
        })
    }

    run() {
        let cmd = this.binPath

        if (this.installService) {
            this.log('debug', 'Installing Rustdesk service...')
            cmd = `${this.binPath} --install-service`
        }

        child.exec(cmd, (err: any, stdout: any, stderr: any) => {
            if (err || stderr) throw err
        })
    }

    getId(): Promise<number> {
        return new Promise((resolve, reject) => {
            try {
                this.log('debug', 'Getting rustdesk id...')

                child.exec(`${this.binPath} --get-id`, (err: any, stdout: string, stderr: any) => {
                    if (err || stderr) throw err

                    this.id = parseInt(stdout)
                    resolve(this.id)
                })
            } catch (error) {
                reject(error)
            }
        })
    }

    setConfig(): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                this.log('debug', 'Setting config: ' + this.config)

                child.exec(
                    `${this.binPath} --config ${this.config}`,
                    (err: any, stdout: string, stderr: any) => {
                        if (err || stderr) throw err

                        resolve()
                    }
                )
            } catch (error) {
                reject(error)
            }
        })
    }

    setPassword(): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                if (!this.password) {
                    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

                    let pass = ''
                    for (let i = 0; i < 10; i++) {
                        pass += chars.charAt(Math.floor(Math.random() * chars.length))
                    }

                    this.password = pass

                    this.log('debug', 'Setting random password: ' + this.password)
                } else {
                    this.log('debug', 'Setting provided password: ' + this.password)
                }

                child.exec(
                    `${this.binPath} --password ${this.password}`,
                    (err: any, stdout: string, stderr: any) => {
                        if (err || stderr) throw err

                        resolve()
                    }
                )
            } catch (error) {
                reject(error)
            }
        })
    }
}

;(async () => {
    const r = new RustdeskWindows()
    await r.init()
})()
