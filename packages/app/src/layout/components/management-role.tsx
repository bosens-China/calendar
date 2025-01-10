import { useDelete } from '@/hooks/use-delete';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { Role, selectRole, updateRole } from '@/store/slice/role';
import { selectTag } from '@/store/slice/tag';
import {
  Button,
  Modal,
  Space,
  Table,
  Tag,
  App,
  Popconfirm,
  Form,
  Input,
  InputRef,
} from 'antd';
import { TableProps } from 'antd/lib';
import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface Props {
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  open: boolean;
}

type DataType = Role;

export const ManagementRole: FC<Props> = ({ open, setOpen }) => {
  const handleOk = () => {
    setOpen(false);
  };

  const handleCancel = () => {
    setOpen(false);
  };

  const { message } = App.useApp();

  const { roles } = useAppSelector(selectRole);
  const { tags } = useAppSelector(selectTag);
  const dispatch = useAppDispatch();
  const [editingKey, setEditingKey] = useState('');
  const inputRef = useRef<InputRef>(null);

  const { deleteRole } = useDelete();

  const columns: TableProps<DataType>['columns'] = [
    {
      title: '角色名称',
      dataIndex: 'name',
      width: '30%',
      key: 'name',
      render: (value: string, { id }: DataType) => {
        if (editingKey === id) {
          return (
            <Form.Item
              name="name"
              initialValue={value}
              rules={[
                {
                  required: true,
                  message: '请输入角色名称',
                  transform(value) {
                    return value.trim();
                  },
                },
              ]}
            >
              <Input ref={inputRef} />
            </Form.Item>
          );
        }
        return <span>{value}</span>;
      },
    },
    {
      title: '已关联标签',
      key: 'tag',
      render(_: unknown, { id }: DataType) {
        const arr = Object.values(tags).filter((f) => {
          return f.roleId === id;
        });
        if (arr.length) {
          return (
            <Space wrap size="small">
              {arr.map((item) => {
                return (
                  <Tag key={item.id} color={item.color}>
                    {item.name}
                  </Tag>
                );
              })}
            </Space>
          );
        }
        return <span>暂无</span>;
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render(_: unknown, record: DataType) {
        const { id } = record;
        if (editingKey !== id) {
          return (
            <Space>
              <Button
                className="px-0!"
                type="link"
                onClick={() => {
                  setEditingKey(id);
                  form.resetFields();
                  form.setFieldsValue(record);
                  setTimeout(() => {
                    inputRef.current?.focus();
                  }, 0);
                }}
                disabled={!!editingKey}
              >
                编辑
              </Button>

              <Popconfirm
                title="确认删除"
                description="确认删除吗？删除后角色下的标签，以及关联的日程都会被清空。"
                onConfirm={() => {
                  deleteRole(id);
                  message.success('删除成功');
                }}
                disabled={!!editingKey}
              >
                <Button className="px-0!" type="link" disabled={!!editingKey}>
                  删除
                </Button>
              </Popconfirm>
            </Space>
          );
        }
        return (
          <Space>
            <Button
              className="px-0!"
              type="link"
              onClick={async () => {
                const values = await form.validateFields();
                dispatch(
                  updateRole({ id, ...values, name: values.name.trim() }),
                );
                message.success('更新成功！');
                cancel();
              }}
            >
              保存
            </Button>
            <Button
              className="px-0!"
              type="link"
              onClick={() => {
                setEditingKey('');
              }}
            >
              取消
            </Button>
          </Space>
        );
      },
    },
  ];

  const data = useMemo<DataType[]>(() => {
    return roles;
  }, [roles]);

  const [form] = Form.useForm<Pick<DataType, 'name'>>();

  const cancel = useCallback(() => {
    setEditingKey('');
  }, [setEditingKey]);

  useEffect(() => {
    if (!open) {
      return;
    }
    cancel();
  }, [cancel, open]);

  return (
    <Modal
      title="管理角色"
      open={open}
      onOk={handleOk}
      onCancel={handleCancel}
      width={800}
    >
      <Form form={form} component={false}>
        <Table<DataType>
          columns={columns}
          dataSource={data}
          rowKey={'id'}
          pagination={{ onChange: cancel }}
        />
      </Form>
    </Modal>
  );
};
