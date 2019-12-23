/**
 * get SubMenu or Item
 */
const getSubMenu = item => {
  // doc: add hideChildrenInMenu
  if (item.children && item.children.some(child => child.name)) {
    return {
      ...item,
      children: filterMenuData(item.children), // eslint-disable-line
    };
  }
  return item;
};

/**
 * filter menuData
 */
const filterMenuData = menuData => {
  if (!menuData) {
    return [];
  }
  return menuData
    .filter(item => item.name)
    .map(item => getSubMenu(item))
    .filter(item => item);
};
/**
 * 获取面包屑映射
 * @param {Object} menuData 菜单配置
 */
const getBreadcrumbNameMap = menuData => {
  if (!menuData) {
    return {};
  }
  const routerMap = {};

  const flattenMenuData = data => {
    data.forEach(menuItem => {
      if (menuItem.children) {
        flattenMenuData(menuItem.children);
      }
      // Reduce memory usage
      routerMap[menuItem.path] = menuItem;
    });
  };
  flattenMenuData(menuData);
  return routerMap;
};

const staticMenu = [
  {
    name: "Environment",
    path: "envs/",
    icon: "dashboard"
  }, {
    name: "Playbook",
    path: "playbooks/",
    icon: "dashboard"
  }, {
    name: "Project",
    path: "projects/",
    icon: "dashboard"
  }, {
    name: "Commits",
    path: "commits/",
    icon: "dashboard"
  }
];

export default {
  namespace: 'menu',

  state: {
    menuData: staticMenu,
    breadcrumbNameMap: getBreadcrumbNameMap(staticMenu)
  }
};
