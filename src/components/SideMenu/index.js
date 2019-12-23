import React from 'react';
import { Drawer } from 'antd';
import SideMenu from './SideMenu';
import { getFlatMenuKeys } from './SideMenuUtils';

const SiderMenuWrapper = React.memo(props => {
  const { isMobile, menuData, collapsed, onCollapse } = props;
  const flatMenuKeys = getFlatMenuKeys(menuData);
  return isMobile ? (
    <Drawer
      visible={!collapsed}
      placement="left"
      onClose={() => onCollapse(true)}
      style={{
        padding: 0,
        height: '100vh',
      }}
    >
      <SideMenu {...props} flatMenuKeys={flatMenuKeys} collapsed={isMobile ? false : collapsed} />
    </Drawer>
  ) : (
    <SideMenu {...props} flatMenuKeys={flatMenuKeys} />
  );
});

export default SiderMenuWrapper;
