const env = 'prod' // 当项目上线后，将dev改变，则constant.js中的UPLOAD_PATH路径就不再是测试环境的路径，而是线上服务器端路径

module.exports = { env }
