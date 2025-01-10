import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { addRole, selectRole, setCurrentRole } from '@/store/slice/role';
import { PlusOutlined, SettingOutlined } from '@ant-design/icons';
import { Button, Divider, Input, InputRef, Select, Space, App } from 'antd';
import { useMemo, useRef, useState } from 'react';
import { v6 as uuid } from 'uuid';
import { ManagementRole } from './management-role';
import { appendOpenkeys } from '@/store/slice/tag';

export const Role = () => {
  const [name, setName] = useState('');
  const inputRef = useRef<InputRef>(null);
  const onNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setName(event.target.value);
  };
  const { message } = App.useApp();

  const addItem = (
    e: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>,
  ) => {
    e.preventDefault();
    const str = name.trim();
    if (!str) {
      return;
    }
    if (roles.some((f) => f.name === str)) {
      message.error('角色已存在！');
      return;
    }
    const newId = uuid();
    dispatch(addRole({ name: str, id: newId }));
    dispatch(appendOpenkeys(newId));
    setName('');
    message.success('创建角色完成！');
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };

  const { roles, currentRole } = useAppSelector(selectRole);
  const dispatch = useAppDispatch();

  const options = useMemo(() => {
    return roles.map((role) => ({
      label: role.name,
      value: role.id,
    }));
  }, [roles]);

  const [open, setOpen] = useState(false);

  return (
    <>
      <Select
        mode="tags"
        placeholder="请选择角色"
        value={currentRole}
        style={{ width: 220 }}
        onChange={(value) => {
          dispatch(setCurrentRole(value));
        }}
        dropdownRender={(menu) => (
          <>
            {menu}
            <Divider style={{ margin: '8px 0' }} />
            <Space
              className="flex items-center"
              direction="vertical"
              align="center"
            >
              <Input
                placeholder="请输入角色名称"
                ref={inputRef}
                value={name}
                onChange={onNameChange}
                onKeyDown={(e) => e.stopPropagation()}
              />
              <Button
                type="text"
                className="w-180px!"
                icon={<PlusOutlined />}
                onClick={addItem}
                block
              >
                添加角色
              </Button>
              <Button
                type="text"
                icon={<SettingOutlined />}
                onClick={() => {
                  setOpen(true);
                }}
                className="w-180px!"
              >
                管理角色
              </Button>
            </Space>
          </>
        )}
        options={options}
      />
      <ManagementRole open={open} setOpen={setOpen}></ManagementRole>
    </>
  );
};
