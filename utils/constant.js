const { env } = require('./env')

let resUrl
let mp3FilePath
let dbHost
let dbUser
let dbPwd

if (env === 'dev') {
    dbHost = 'localhost'
    dbUser = 'root'
    dbPwd = '12345678'
} else if (env === 'prod') {
    dbHost = '47.94.255.67'
    dbUser = 'root'
    dbPwd = 'Ab123456789@'
}

const UPLOAD_PATH = env === 'prod' ? 'D:\\workplace\\XiaoMuDu\\imooc\\admin-upload-ebook' : '/root/upload/admin-upload/ebook'
const OLD_UPLOAD_URL = env === 'prod' ? 'http://www.xinwenkan.top:8089/res/img' : 'https://www.xinwenkan.top:8089/res/img'
const UPLOAD_URL = env === 'prod' ? 'http://www.xinwenkan.top:8089' : 'https://www.xinwenkan.top:8089'
module.exports = {
    CODE_ERROR: -1,
    CODE_SUCCESS: 0,
    CODE_TOKEN_EXPIRED: -2,
    debug: true, // 上线的时候，改为false
    PWD_SALT: 'admin_imooc_node', // 相当于jwt中的密钥，密钥和我们输入的密码混合后形成新的密码，去和数据库中的密码比较
    PRIVATE_KEY: 'admin_imooc_node_test_youbaobao_xyz', // token在服务器端的密钥
    JWT_EXPIRED: 60 * 60, // token的过期时间，jwt何时失效 (秒为单位，60*60=3600秒)
    UPLOAD_PATH,
    MIME_TYPE_EPUB: 'application/epub+zip',
    UPLOAD_URL,
    OLD_UPLOAD_URL,
    dbHost,
    dbPwd,
    dbUser
}