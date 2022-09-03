// 代表一本电子书
const { MIME_TYPE_EPUB, UPLOAD_URL, UPLOAD_PATH, OLD_UPLOAD_URL } = require('../utils/constant')
const fs = require('fs')
const Epub = require('../utils/epub')
const path = require('path')
const { param } = require('../router')
const xml2js = require('xml2js').parseString

class Book {
    // 如果是file，代表刚上传了一本电子书（解析电子书数据）
    // 如果是data，代表我们希望更新或者插入电子书数据（向数据库中更新插入电子书数据）
    constructor(file, data) {
        if (file) {
            // 当我们在页面上传一本电子书时，就是file
            this.createBookFromFile(file)
        } else {
            // 当我们需要把已经上传的电子书添加到数据库中时，req.body中携带的信息就是data
            this.createBookFromData(data)
        }
    }

    createBookFromFile(file) {
        // console.log('从file创建Book实例', file)
        /**
         * 从file创建Book实例 {
            fieldname: 'file',
            originalname: 'ç\x99¾å¹´å­¤ç\x8B¬.epub',
            encoding: '7bit',
            mimetype: 'application/epub',
            destination: 'D:\\workplace\\XiaoMuDu\\imooc\\admin-upload-ebook/book',
            filename: '87c375d387cec784e0392d66a5f7fa00',
            path: 'D:\\workplace\\XiaoMuDu\\imooc\\admin-upload-ebook\\book\\87c375d387cec784e0392d66a5f7fa00',
            size: 427154
            }
         */
        const {
            destination, // 上传路径
            filename, // 上传后的文件名
            mimetype = MIME_TYPE_EPUB, // 文件类型，通过Book创建的实例必须是epub类型的资源，因此可以将epub设置为mimetype的默认类型
            path,
            originalname
            
        } = file
        // 因为上传后的文件没有epub后缀，要重新添加。suffix用来存放后缀名
        // const suffix = mimetype === MIME_TYPE_EPUB ? '.epub' : '.epub'
        const suffix = mimetype === 'application/epub' ? '.epub' : ''
        // 电子书的原有路径
        const oldBookPath = path
        // 电子书的新路径
        const bookPath = `${destination}/${filename}${suffix}`
        // 电子书的下载url链接
        const url = `${UPLOAD_URL}/book/${filename}${suffix}`
        // 电子书的解压后的文件夹路径
        const unzipPath = `${UPLOAD_PATH}/unzip/${filename}`
        // 电子书解压后的文件夹URL
        const unzipUrl = `${UPLOAD_URL}/unzip/${filename}`
        
        // 如果电子书不存在解压路径
        if (!fs.existsSync(unzipPath)) {
            // 我们就通过迭代的方式去创建这个文件夹
            fs.mkdirSync(unzipPath, { recursive: true })
        }

        // 通过对文件重新命名的方式，给文件添加‘.epub的后缀’
        // console.log('fs.renameSync---', suffix)
        // console.log('fs.renameSync---', bookPath)
        if (fs.existsSync(oldBookPath) && !fs.existsSync(bookPath)) {
            fs.renameSync(oldBookPath, bookPath)
        }

        // 电子书有一个主键，是fileName不能重复的。因此filename由于不会重复，可以用来当做主键的文件名，不包含后缀
        this.fileName = filename
        // epub文件相对路径
        this.path = `/book/${filename}${suffix}`
        this.filePath = this.path
        // epub解压后相对路径
        this.unzipPath = `/unzip/${filename}` 
        // epub文件下载链接
        this.url = url
        // 电子书标题或者书名
        this.title = ''
        // 作者
        this.author = ''
        // 出版社
        this.publisher = ''
        // 目录
        this.contents = []
        // 树状目录结构
        this.contentsTree = []
        // 封面图片URL
        this.cover = ''
        // 封面图片的路径
        this.coverPath = ''
        // 分类ID
        this.category = -1
        // 分类名称
        this.categoryText = ''
        // 语种
        this.language = ''
        // 解压后文件夹链接
        this.unzipUrl = unzipUrl
        // 电子书文件的原名
        this.originalName = originalname
        console.log('-----------', originalname)
    }

    createBookFromData(data) {
        this.fileName = data.fileName
        this.cover = data.coverPath
        this.title = data.title
        this.author = data.author
        this.publisher = data.publisher
        this.bookId = data.fileName
        this.language = data.language
        this.rootFile = data.rootFile
        this.originalName = data.originalName
        this.path = data.path || data.filePath
        this.filePath = data.path || data.filePath
        this.unzipPath = data.unzipPath
        this.coverPath = data.coverPath
        this.createUser = data.username
        this.createDt = new Date().getTime()
        this.updateDt = new Date().getTime()
        this.updateType = data.updateType === 0 ? data.updateType : 1
        this.category = data.category || 99
        this.categoryText = data.categoryText || '自定义'
        this.contents = data.contents || []
    }

    // 通过parse方法，将createBookFromFile(file)中的属性获取完善
    parse() {
        return new Promise((resolve, reject) => {
            const bookPath = `${UPLOAD_PATH}${this.filePath}`
            if (!fs.existsSync(bookPath)) {
                reject(new Error('电子书不存在'))
            }
            const epub = new Epub(bookPath)
            epub.on('error', err => {
                reject(err)
            })
            epub.on('end', err => {
                if (err) {
                    reject(err)
                } else {
                    // console.log(epub.metadata)
                    // console.log('epub end', epub)
                    const {
                        title,
                        language,
                        creator,
                        creatorFileAs,
                        publisher,
                        cover
                    } = epub.metadata
                    if (!title) {
                        reject(new Error('图书标题为空'))
                    } else {
                        this.title = title
                        this.language = language || 'en'
                        this.author = creator || creatorFileAs || 'unknown'
                        this.publisher = publisher || 'unknown'
                        this.rootFile = epub.rootFile

                        // 配合epub.getImage()的处理函数
                        const handleGetImage = (err, file, mimeType) => {
                                // file就是getImage源码中的data，是一个buffer对象（需要转化为文件）
                                // 此时buffer对象代表文件读取在内存当中
                                // console.log('err,file,mimeType: ', err, file, mimeType)
                                if (err) {
                                    reject(err)
                                } else {
                                    const suffix = mimeType.split('/')[1] // image/jpeg取jepg
                                    const coverPath = `${UPLOAD_PATH}/img/${this.fileName}.${suffix}`
                                    const coverUrl = `${UPLOAD_URL}/img/${this.fileName}.${suffix}`
                                    fs.writeFileSync(coverPath, file, 'binary') // （文件要写到的路径，具体文件的buffer，写入的类型）
                                    this.coverPath = `/img/${this.fileName}.${suffix}`
                                    this.cover = coverUrl
                                    resolve(this)
                                }
                            }
                        
                        // 解压epub
                        try {
                            this.unzip() // 这是一个同步方法,用于解压epub文件到unzip文件夹中
                            // 获取目录资源文件ncx
                            this.parseContents(epub).then(({ chapters, chapterTree }) => {
                                this.contents = chapters
                                this.contentsTree = chapterTree
                                // 获取封面图片：
                                // 为什么这里使用箭头函数？
                                // 因为我希望this指向的是他上级作用域的this。
                                // 而function函数内的this指向当前作用域
                                // 箭头函数内的作用域是undefined，因此会默认找上级作用域
                                epub.getImage(cover, handleGetImage)
                            })

                            
                        } catch (e) {
                            reject(e)
                        }
                    }
                }
            })
            epub.parse()
        })
    }

    unzip() {
        const AdmZip = require('adm-zip')
        const zip = new AdmZip(Book.genPath(this.path))
        zip.extractAllTo(Book.genPath(this.unzipPath), true) // 将这个路径下的文件进行解压，并放到新的路径下; true 进行覆盖
    }

    parseContents(epub) {
        function getNcxFilePath() {
            const spine = epub && epub.spine
            const manifest = epub && epub.manifest
            // console.log('spine', spine)
            // spine {
            //     toc: {
            //       id: 'ncx',
            //       href: 'OEBPS/toc.ncx',
            //       'media-type': 'application/x-dtbncx+xml'
            //     },
            //  ...
            // }
            const ncx = spine.toc && spine.toc.href
            const id = spine.toc && spine.toc.id
            // console.log(spine.toc, ncx, id, manifest[id].href)
            // {
            //     id: 'ncx',
            //     href: 'OEBPS/toc.ncx',
            //     'media-type': 'application/x-dtbncx+xml'
            //   } OEBPS/toc.ncx ncx OEBPS/toc.ncx
            if (ncx) {
                // 如果有href那么直接获取
                return ncx
            } else {
                // 如果没有href那么通过manifest匹配id获取到href
                return manifest[id].href
            }
        }

        function findParent(array, level = 0, pid = '') {
            // level 0代表第一级；  pid 上一级的navId
            return array.map(item => {
                item.level = level
                item.pid = pid
                if (item.navPoint && item.navPoint.length > 0) {
                    // 说明存在子目录
                    /**   navPoint: [
                            { '$': [Object], navLabel: [Object], content: [Object] },
                            { '$': [Object], navLabel: [Object], content: [Object] },
                            { '$': [Object], navLabel: [Object], content: [Object] },
                            {
                                '$': [Object],
                                navLabel: [Object],
                                content: [Object],
                                navPoint: [Array] 子目录存在
                            }, ...]
                    */
                    item.navPoint = findParent(item.navPoint, level + 1, item['$'].id)
                } else if (item.navPoint) {
                    item.navPoint.level = level + 1
                    item.navPoint.pid = item['$'].id
                }
                return item
            })
        }

        function flatten(array) {
            // 将array中的内容展开后，插入到新数组[]中
            return [].concat(...array.map(item => {
                // console.log('flatten 内的item为:', item)
                if (item.navPoint && item.navPoint.length > 0) {
                    return [].concat(item, ...flatten(item.navPoint))
                } else if (item.navPoint) {
                    return [].concat(item, item.navPoint)
                }
                return item
            }))
        }

        const ncxFilePath =  Book.genPath(`${this.unzipPath}/${getNcxFilePath()}`)
        // console.log('ncxFilePath目录ncx解压路径', ncxFilePath)
        // D:\workplace\XiaoMuDu\imooc\admin-upload-ebook/unzip/5c832300dcd12b353e449c297fe0e1ef/OEBPS/toc.ncx
        if (fs.existsSync(ncxFilePath)) {
            return new Promise((resolve, reject) => {
                const xml = fs.readFileSync(ncxFilePath, 'utf-8') // 读取目录文件
                const dir = path.dirname(ncxFilePath).replace(UPLOAD_PATH, '') // 目录文件toc.ncx所在的路径，用于和content中的src相对路径组合;
                // console.log('ncx dir: ', dir)
                const fileName = this.fileName
                const unzipPath = this.unzipPath
                xml2js(
                    xml,
                    {
                        explicitArray: false,
                        ignoreAttrs: false
                    },
                    function(err, json) {
                        if (err) {
                            reject(err)
                        } else {
                            const navMap = json.ncx.navMap
                            // console.log('xml', navMap)
                            // console.log('xml:', JSON.stringify(navMap))
                            if (navMap.navPoint && navMap.navPoint.length >0) {
                                // 将通过map()进行遍历，将{navPoint: {{...},{...},...}}变为[{...},{...},...]
                                navMap.navPoint = findParent(navMap.navPoint)
                                // console.log('map遍历', navMap.navPoint)
                                // 将树状结构变成一维结构
                                const newNavMap = flatten(navMap.navPoint)
                                // console.log('newNavMap:', newNavMap[0].content['$'].src) // 这个src存放的是该目录章节的相对路径
                                // console.log(newNavMap === navMap.navPoint) false:说明我们复制了一个新数组，不会改变原来的值
                                const chapters = []
                                // epub.flow解析电子书目录，为什么还用forEach手动解析？因为有些电子书可能会出现解析错误
                                // epub.flow.forEach((chapter, index) => {
                                // epub.flow和newNavMap获取到的目录数量是不一样的，
                                newNavMap.forEach((chapter, index) => {
                                    // console.log('chapter', chapter, index)
                                    // if (index + 1 > newNavMap.length) {
                                    //     return
                                    // }
                                    // const nav = newNavMap[index]
                                    // console.log('nav:', nav.navLabel)
                                    const src = chapter.content['$'].src
                                    chapter.id = `${src}`
                                    chapter.href = `${dir}/${src}`.replace(unzipPath, '')
                                    // chapter.text = `${UPLOAD_URL}/unzip/${fileName}/${chapter.href}`
                                    chapter.text = `${UPLOAD_URL}${dir}/${src}`
                                    // console.log('chapter', chapter)
                                    chapter.label = chapter.navLabel.text || ''
                                    // chapter.level = nav.level
                                    // chapter.pid = nav.pid
                                    chapter.navId = chapter['$'].id
                                    chapter.fileName = fileName
                                    chapter.order = index + 1
                                    // console.log('chapter:', chapter)
                                    chapters.push(chapter)
                                })
                                // 因为chapters是一维，无法适配el-tree中的结构，所以要创建一个适配的数组结构方便el-tree进行目录展示
                                // chapterTree是为了适应前端el-tree的结构
                                const chapterTree = []
                                chapters.forEach(c => {
                                    c.children = []
                                    if (c.pid === '') {
                                        // 如果pid为空，意味着该章节为一级目录
                                        chapterTree.push(c)
                                    } else {
                                        // 如果不为空，说明本次循环的该章节为某一章节的子目录
                                        // 因此，使用findc查找chapters数组中的指定对象，当章节navId与本次循环章节的父目录id相同，说明章节navId为本次循环章节的父目录
                                        const parent = chapters.find(_ => _.navId === c.pid)
                                        parent.children.push(c)
                                    }
                                })
                                // console.log(chapters)
                                resolve({ chapters, chapterTree })
                            } else {
                                reject(new Error('目录解析失败，目录为0'))
                            }
                        }
                    }
                )
            })
        } else {
            throw new Error('目录文件不存在')
        }
    }

    // 将我们book对象中与数据库相关的字段提取出来，公布给数据库使用，而不需要把所有数据放到sql语句中
    toDb() {
        return {
            fileName: this.fileName,
            cover: this.coverPath,
            title: this.title,
            author: this.author,
            publisher: this.publisher,
            bookId: this.fileName,
            language: this.language,
            rootFile: this.rootFile,
            originalName: this.originalName,
            filePath: this.filePath,
            unzipPath: this.unzipPath,
            coverPath: this.coverPath,
            createUser: this.createUser,
            createDt: this.createDt,
            updateDt: this.updateDt,
            updateType: this.updateType,
            category: this.category,
            categoryText: this.categoryText
        }
    }

    // 得到目录内容
    getContents() {
        return this.contents
    }

    // 删除解析epub生成的文件
    reset() {
        // console.log('将要删除的文件fileName：', this.fileName)
        // 判断文件路径是否存在
        if (Book.pathExists(this.filePath)) {
            // console.log('删除文件...')
            fs.unlinkSync(Book.genPath(this.filePath))
        }
        // 判断封面路径是否存在
        if (Book.pathExists(this.coverPath)) {
            // console.log('删除封面...')
            fs.unlinkSync(Book.genPath(this.coverPath))
        }
        // 判断解压目录是否存在
        if (Book.pathExists(this.unzipPath)) {
            // console.log('删除解压目录...')
            // 低版本node不支持recursive: true
            // 因为改路径是个文件夹，因此要用rmdirSync，同时设置recursive: true表示迭代删除
            fs.rmdirSync(Book.genPath(this.unzipPath), { recursive: true })
        }
    }

    static genPath(path) {
        if (!path.startsWith('/')) {
            path = `/${path}`
        }
        return `${UPLOAD_PATH}${path}`
    }

    // 判断路径是否存在
    static pathExists(path) {
        if (path.startsWith(UPLOAD_PATH)) {
            // 如果该路径path是UPLOAD_PATH开头的
            return fs.existsSync(path)
        } else {
            return fs.existsSync(Book.genPath(path))
        }
    }

    // services/book.js中getBook(): 将${OLD_UPLOAD_URL}地址和老书的${cover}组合
    static genCoverUrl(book) {
        const { cover } = book
        if (+book.updateType === 0) {
            // 老书
            // 判断老书的图片路径是否存在
            if (cover) {
                // 判断老书的图片路径是否是 / 开头
                if (cover.startsWith('/')) {
                    return `${OLD_UPLOAD_URL}${cover}`
                } else {
                    return `${OLD_UPLOAD_URL}/${cover}`
                }
            } else {
                return null
            }
        } else {
            // 新书
            if (cover) {
                if (cover.startsWith('/')) {
                    return `${UPLOAD_URL}${cover}`
                } else {
                    return `${UPLOAD_URL}/${cover}`
                }
            } else {
                return null
            }
        }
    }

    // services/book.js中getBook(): 
    static genContentsTree(contents) {
        // const { contents } = book
        if (contents) {
            const contentsTree = []
            contents.forEach(c => {
                c.children = []
                if (c.pid === '') {
                    // 如果pid为空，意味着该章节为一级目录
                    contentsTree.push(c)
                } else {
                    // 如果不为空，说明本次循环的该章节为某一章节的子目录
                    // 因此，使用findc查找chapters数组中的指定对象，当章节navId与本次循环章节的父目录id相同，说明章节navId为本次循环章节的父目录
                    const parent = contents.find(_ => _.navId === c.pid)
                    parent.children.push(c)
                }
            })
            return contentsTree
        }
    }
}



module.exports = Book