# pipeline-playbook 使用说明

## 开始使用

### 如何安装插件

1. 下载并安装Jenkins  
   参考Jenkins官方文档进行安装（https://jenkins.io/doc/pipeline/tour/getting-started/）
2. 在Jenkins插件管理页面安装pipeline相关的插件
3. 创建名为`pipeline-playbook-plugin-installer`的pipeline类型的Jenkins job，进入job的配置页面，并按照下图进行配置  
   ![pipeline-playbook-plugin-installer-configure](images/pipeline-playbook-plugin-installer-configure.png)  
   注意：`Repository URL`应改为你的私有仓库代码地址
4. 执行刚刚创建的job `pipeline-playbook-plugin-installer`，执行期间Jenkins会自动重启，插件会在重启之后安装成功

### 配置插件

在Jenkins重启之后，请转到Jenkins的系统配置页面，你将能够看到如下的一组新增的配置：

