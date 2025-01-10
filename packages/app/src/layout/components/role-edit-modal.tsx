import { App, Form, Input, InputRef, Modal } from 'antd';
import { FC, useEffect, useRef } from 'react';
import { List } from '@/store/slice/tag';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { Role, selectRole, updateRole } from '@/store/slice/role';

export type FormDataTag = List | Pick<List, 'roleId'>;

interface Props {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  formData: Role;
}

export const RoleEditModal: FC<Props> = ({ setOpen, open, formData }) => {
  const [form] = Form.useForm<Omit<List, 'id'>>();
  const { roles } = useAppSelector(selectRole);
  const dispatch = useAppDispatch();

  const { message } = App.useApp();
  const handleOk = async () => {
    const values = await form.validateFields();

    dispatch(updateRole({ ...formData, ...values }));
    message.success('更新角色名称完成');

    setOpen(false);
  };

  const handleCancel = () => {
    setOpen(false);
  };
  const inputRef = useRef<InputRef>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const initialValues = { ...formData };
    form.resetFields();
    form.setFieldsValue(initialValues);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, form]);

  return (
    <Modal
      title={'编辑角色'}
      open={open}
      onOk={handleOk}
      onCancel={handleCancel}
      okButtonProps={{ htmlType: 'submit' }}
    >
      <Form
        form={form}
        labelCol={{ span: 4 }}
        wrapperCol={{ span: 20 }}
        style={{ maxWidth: 600 }}
        autoComplete="off"
        onFinish={handleOk}
        onFinishFailed={() => {}}
      >
        <Form.Item<List>
          label="角色名称"
          name="name"
          rules={[
            { required: true, message: '角色名称不可省略!' },
            {
              validator: async (_rule, value: string) => {
                const keys = roles.filter((f) => f.id !== formData.id);
                if (keys.find((f) => f.name === value)) {
                  return Promise.reject('角色名称已存在');
                }
              },
            },
          ]}
        >
          <Input ref={inputRef} placeholder="请输入角色名称" />
        </Form.Item>
      </Form>
    </Modal>
  );
};
