import {
  Badge,
  Button,
  Dropdown,
  Layout,
  App,
  Menu,
  Empty,
  Typography,
} from 'antd';
import { removeTag, selectTag, updateOpenKeys } from '@/store/slice/tag';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import React, { FC, useMemo, useState } from 'react';
import {
  CloudDownloadOutlined,
  DeleteOutlined,
  EditOutlined,
  ExclamationCircleFilled,
  FileMarkdownOutlined,
  GithubOutlined,
  MenuOutlined,
  MoreOutlined,
  SendOutlined,
} from '@ant-design/icons';
import { removeRecordTag, selectRecord } from '@/store/slice/record';
import { MenuProps } from 'antd/lib';
import { Role as RoleComponent } from './components/role';
import { Role, selectRole } from '@/store/slice/role';
import { FormDataTag } from './components/tag-action-modal';
import { RoleEditModal } from './components/role-edit-modal';
import { useDelete } from '@/hooks/use-delete';
import { useMount } from 'ahooks';

const { Sider } = Layout;
const { Text } = Typography;

interface Props {
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setFormData: React.Dispatch<React.SetStateAction<FormDataTag | undefined>>;
}
type MenuItem = Required<MenuProps>['items'][number];
export const LayoutSider: FC<Props> = ({ setOpen, setFormData }) => {
  const { tags, openKeys } = useAppSelector(selectTag);
  const { currentRole, roles } = useAppSelector(selectRole);
  const { records } = useAppSelector(selectRecord);
  const dispatch = useAppDispatch();
  const { message, modal } = App.useApp();

  const [roleOpen, setRoleOpen] = useState(false);
  const [roleFormData, setRoleFormData] = useState<Role>();
  const { deleteRole } = useDelete();

  const items = useMemo(() => {
    return currentRole.map((role): MenuItem => {
      const label = roles.find((f) => f.id === role)!.name;
      return {
        label: (
          <div className="flex items-center flex-justify-between">
            <Text className="w-180px" ellipsis={{ tooltip: label }}>
              {label}
            </Text>
            <div className="flex items-center">
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  setFormData({
                    roleId: role,
                  });
                  setOpen(true);
                }}
                type="link"
                disabled={!currentRole.length}
                className="outline-0! p-0!"
              >
                创建标签
              </Button>
              <Dropdown
                menu={{
                  items: [
                    {
                      label: '编辑',
                      key: 'edit',
                      icon: <EditOutlined />,
                      onClick(e) {
                        e.domEvent.stopPropagation();
                        setRoleOpen(true);
                        setRoleFormData(roles.find((f) => f.id === role));
                      },
                    },
                    {
                      label: `删除`,
                      key: 'delete',
                      icon: <DeleteOutlined />,
                      onClick(e) {
                        e.domEvent.stopPropagation();
                        modal.confirm({
                          title: '确认删除',
                          icon: <ExclamationCircleFilled />,
                          content:
                            '确定删除吗？删除后角色下的标签，以及关联的日程都会被清空。',
                          okType: 'danger',

                          onOk() {
                            deleteRole(role);
                            message.success('删除成功');
                          },
                        });
                      },
                    },
                  ],
                  onClick: () => {},
                }}
              >
                <Button
                  type="link"
                  className="p-0! border-transparent border-width-6 border-solid"
                >
                  <MoreOutlined />
                </Button>
              </Dropdown>
            </div>
          </div>
        ),
        key: role,
        children: Object.entries(tags)
          .filter(([, value]) => {
            return value.roleId === role;
          })
          .map(([id, value]) => {
            const total = records.filter((f) => f.tagId === id).length;
            return {
              label: (
                <Badge
                  color={value.color}
                  className="[&_.ant-badge-status-text]:lh-none lh-none!"
                  text={
                    <Text
                      className="w-150px lh-none"
                      ellipsis={{ tooltip: value.name }}
                    >
                      <span>{value.name}</span>
                      <span className="ml-3px">[{total}]</span>
                    </Text>
                  }
                />
              ),
              extra: (
                <Dropdown
                  trigger={['click', 'hover']}
                  menu={{
                    items: [
                      {
                        label: '编辑',
                        key: 'edit',
                        icon: <EditOutlined />,
                        onClick() {
                          setOpen(true);
                          setFormData(value);
                        },
                      },
                      {
                        label: `删除`,
                        key: 'delete',
                        icon: <DeleteOutlined />,
                        onClick() {
                          modal.confirm({
                            title: '删除确认',
                            icon: <ExclamationCircleFilled />,
                            content:
                              '确定删除标签吗，删除会导致相关事项同步被删除！',
                            okType: 'danger',

                            onOk() {
                              dispatch(removeTag(id));
                              dispatch(removeRecordTag(id));
                              message.success('删除成功');
                            },
                          });
                        },
                      },
                    ],
                  }}
                >
                  <Button
                    className="color-#666"
                    type="link"
                    icon={<MoreOutlined />}
                  ></Button>
                </Dropdown>
              ),
              key: id,
            };
          }),
      };
    });
  }, [
    currentRole,
    roles,
    tags,
    setFormData,
    setOpen,
    modal,
    deleteRole,
    message,
    records,
    dispatch,
  ]);

  const menuItems: MenuProps['items'] = [
    {
      label: '导入',
      key: 'import',
      icon: <SendOutlined />,
    },
    {
      label: '导出',
      key: 'export',
      icon: <CloudDownloadOutlined />,
    },
    {
      label: '导入(Tpad Excel)',
      key: 'import-tapd',
      icon: <FileMarkdownOutlined />,
    },
    {
      type: 'divider',
    },
    {
      label: (
        <a href={`https://github.com/bosens-China/calendar/issues`}>问题反馈</a>
      ),
      key: 'feedback',
      icon: <GithubOutlined />,
    },
  ];

  useMount(() => {
    if (!openKeys.length) {
      dispatch(updateOpenKeys([...items.map((f) => f?.key as string)]));
    }
  });

  return (
    <>
      <Sider
        width="280px"
        className="h-100vh overflow-y-auto overflow-x-hidden"
      >
        <div className="flex justify-center pos-sticky top-0 left-0 z-1 bg-#fff">
          <Dropdown menu={{ items: menuItems }}>
            <Button type="link" className="color-#333">
              <MenuOutlined className="text-size-18px" />
            </Button>
          </Dropdown>
          <RoleComponent />
        </div>
        <Menu
          mode="inline"
          items={items}
          openKeys={openKeys}
          theme="light"
          selectable
          className="w-272px m-y-6px"
          selectedKeys={[]}
          onOpenChange={(openKeys) => {
            dispatch(updateOpenKeys(openKeys));
          }}
        />
        {!items.length && <Empty description="暂无角色" />}
      </Sider>

      <RoleEditModal
        open={roleOpen}
        setOpen={setRoleOpen}
        formData={roleFormData!}
      ></RoleEditModal>
    </>
  );
};
