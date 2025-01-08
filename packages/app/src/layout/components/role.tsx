import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { addRole, selectRole, setCurrentRole } from '@/store/slice/role';
import { PlusOutlined } from '@ant-design/icons';
import { Button, Divider, Input, InputRef, Select, Space, App } from 'antd';
import { useMemo, useRef, useState } from 'react';
import { v6 as uuid } from 'uuid';

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
    if (!name) {
      return;
    }
    if (roles.some((f) => f.name === name)) {
      message.error('角色已存在！');
      return;
    }
    dispatch(addRole({ name, id: uuid() }));
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

  return (
    <Select
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
          <Space className="flex" direction="vertical" align="center">
            <Input
              placeholder="请输入角色名称"
              ref={inputRef}
              value={name}
              onChange={onNameChange}
              onKeyDown={(e) => e.stopPropagation()}
            />
            <Button type="text" icon={<PlusOutlined />} onClick={addItem} block>
              添加角色
            </Button>
          </Space>
        </>
      )}
      options={options}
    />
  );
};
