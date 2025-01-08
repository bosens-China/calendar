import { Badge, Button, Dropdown, Layout, App, Menu, Empty, Space } from 'antd';
import { List, removeTag, selectTag } from '@/store/slice/tag';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import React, { FC, useMemo } from 'react';
import {
  DeleteOutlined,
  EditOutlined,
  ExclamationCircleFilled,
  MoreOutlined,
} from '@ant-design/icons';
import { removeRecordTag } from '@/store/slice/record';
import { MenuProps } from 'antd/lib';
import { Role } from './components/role';
import { selectRole } from '@/store/slice/role';

const { Sider } = Layout;

interface Props {
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setFormData: React.Dispatch<React.SetStateAction<List | undefined>>;
}
type MenuItem = Required<MenuProps>['items'][number];
export const LayoutSider: FC<Props> = ({ setOpen, setFormData }) => {
  const { list } = useAppSelector(selectTag);
  const { currentRole } = useAppSelector(selectRole);
  const dispatch = useAppDispatch();
  const { message, modal } = App.useApp();

  const children = useMemo(() => {
    return Object.entries(list)
      .filter(([, value]) => {
        return value.roleId === currentRole;
      })
      .map(([id, value]) => {
        return {
          label: <Badge color={value.color} text={value.name} />,
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
      });
  }, [currentRole, dispatch, list, message, modal, setFormData, setOpen]);

  const items: MenuItem[] = [
    {
      label: (
        <div>
          标签管理
          <Button
            onClick={(e) => {
              e.stopPropagation();
              setOpen(true);
            }}
            type="link"
            disabled={!currentRole}
            className="outline-0"
          >
            创建标签
          </Button>
        </div>
      ),

      key: 'tag',
      children: children,
    },
  ];

  return (
    <Sider width="256px">
      <Space className="flex my-12px" direction="vertical" align="center">
        <Role />
        <Menu
          mode="inline"
          items={items}
          defaultOpenKeys={['tag']}
          theme="light"
          selectable
          className="w-256px"
        />
        {!children.length && <Empty description="暂无标签" />}
      </Space>
    </Sider>
  );
};
