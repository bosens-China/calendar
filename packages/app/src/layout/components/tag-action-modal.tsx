import { App, Button, ColorPicker, Form, Input, Modal } from 'antd';
import { FC, useEffect, useMemo } from 'react';
import { getRandomColor } from '../utils';
import { selectTag, addTag, List, updateTag } from '@/store/slice/tag';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { v6 as uuid } from 'uuid';
import { selectRole } from '@/store/slice/role';

interface Props {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  formData?: List;
  setFormData: React.Dispatch<React.SetStateAction<List | undefined>>;
}

export const TagActionModal: FC<Props> = ({
  setOpen,
  open,
  formData,
  setFormData,
}) => {
  const [form] = Form.useForm<Omit<List, 'id'>>();
  const { list } = useAppSelector(selectTag);
  const { currentRole } = useAppSelector(selectRole);
  const dispatch = useAppDispatch();

  const { message } = App.useApp();
  const handleOk = async () => {
    const values = await form.validateFields();
    (() => {
      const keys = Object.keys(list).filter((f) =>
        formData ? f !== formData.name : true,
      );
      const colors = Object.values(list)
        .map((f) => f.color)
        .filter((f) => (formData ? f !== formData.color : true));
      if (keys.includes(values.name)) {
        message.error('标签名称已存在');
        return;
      }
      if (colors.includes(values.color)) {
        message.error('标签颜色已存在');
        return;
      }
      if (!formData) {
        dispatch(
          addTag({
            ...values,
            id: uuid(),
            roleId: currentRole!,
          }),
        );
        message.success('添加成功');
        return;
      }

      dispatch(updateTag({ id: formData.id, data: values }));
      message.success('更新标签完成');
    })();

    setOpen(false);
    setFormData(undefined);
  };

  const handleCancel = () => {
    setOpen(false);
  };

  useEffect(() => {
    if (!open) {
      return;
    }
    const initialValues = { color: getRandomColor(), ...formData };
    form.resetFields();
    form.setFieldsValue(initialValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, form]);

  const title = useMemo(() => {
    return formData ? '编辑标签' : '添加标签';
  }, [formData]);
  return (
    <Modal
      title={title}
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
          label="标签名称"
          name="name"
          rules={[{ required: true, message: '标签名称不可省略!' }]}
        >
          <Input placeholder="请输入标签名称" />
        </Form.Item>

        <Form.Item<List>
          label="标签颜色"
          name="color"
          rules={[{ required: true, message: '标签颜色不可省略!' }]}
          extra={
            <Button
              className="p-0!"
              type="link"
              onClick={() => {
                form.setFieldValue('color', getRandomColor());
              }}
            >
              切换颜色
            </Button>
          }
        >
          <ColorPicker showText allowClear />
        </Form.Item>
      </Form>
    </Modal>
  );
};
