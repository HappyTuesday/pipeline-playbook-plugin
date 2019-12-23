export default {
    outputPath: "src/main/webapp/playbook-pipeline-manage/",
    base: "/playbook-pipeline-manage/",
    publicPath: "/plugin/playbook-pipeline/playbook-pipeline-manage/",
    plugins: [
        [
            'umi-plugin-react',
            {
                dva: {
                    immer: true
                },
                antd: true,
            },
        ]
    ],
    routes: [
        {
            path: '/',
            component: '../layouts/BasicLayout',
            routes: [
                {
                    path: '/',
                    component: './index.js'
                }, {
                    path: '/envs/',
                    component: './envs/index.js'
                }, {
                    path: '/envs/detail/:name',
                    component: './envs/detail/index.js'
                }, {
                    path: '/playbooks/',
                    component: './playbooks/index.js'
                }, {
                    path: '/playbooks/detail/:name',
                    component: './playbooks/detail/index.js'
                }, {
                    path: '/projects/',
                    component: './projects/index.js'
                }, {
                    path: '/projects/detail/:name',
                    component: './projects/detail/index.js'
                }, {
                    path: '/commits/',
                    component: './commits/index.js'
                }, {
                    path: '/commits/detail/:id',
                    component: './commits/detail/index.js'
                }, {
                    path: '/commits/submit',
                    component: './commits/submit/index.js'
                }, {
                    component: '404',
                }
            ]
        }
    ],
    devtool: "source-map",
    chainWebpack: config => {
        config.mode("development");
        // config.watch(true);
        config.optimization.minimize(false);
    }
}