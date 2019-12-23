import React, { Fragment } from 'react';
import { Layout, Icon } from 'antd';
import GlobalFooter from '@/components/GlobalFooter';

const { Footer } = Layout;
const FooterView = () => (
  <Footer style={{ padding: 0 }}>
    <GlobalFooter
      links={[
        {
          key: 'gitlab',
          title: <Icon type="github" />,
          href: 'https://gitlab.yit.com/operation/com.yit.deploy',
          blankTarget: true,
        }
      ]}
      copyright={
        <Fragment>
          Copyright <Icon type="copyright" /> 2019 Yitiao
        </Fragment>
      }
    />
  </Footer>
);
export default FooterView;
