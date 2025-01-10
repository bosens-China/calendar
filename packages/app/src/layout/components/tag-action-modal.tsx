import { App, Button, ColorPicker, Form, Input, InputRef, Modal } from 'antd';
import { FC, useEffect, useMemo, useRef } from 'react';
import { getRandomColor } from '../utils';
import { selectTag, addTag, List, updateTag } from '@/store/slice/tag';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { v6 as uuid } from 'uuid';

export type FormDataTag = List | Pick<List, 'roleId'>;

interface Props {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  formData?: FormDataTag;
}

export const TagActionModal: FC<Props> = ({ setOpen, open, formData }) => {
  const [form] = Form.useForm<Omit<List, 'id'>>();
  const { tags } = useAppSelector(selectTag);
  const dispatch = useAppDispatch();

  const { message } = App.useApp();
  const handleOk = async () => {
    const values = await form.validateFields();
    values.name = values.name.trim();
    (() => {
      if (!('id' in formData!)) {
        dispatch(
          addTag({
            ...values,
            id: uuid(),
            roleId: formData!.roleId,
          }),
        );
        message.success('添加成功');
        return;
      }

      dispatch(updateTag({ id: formData.id, data: values }));
      message.success('更新标签完成');
    })();

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
    const initialValues = { color: getRandomColor(), ...formData };
    form.resetFields();
    form.setFieldsValue(initialValues);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, form]);

  const title = useMemo(() => {
    return formData && 'id' in formData ? '编辑标签' : '添加标签';
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
          rules={[
            {
              required: true,
              message: '标签名称不可省略!',
              transform(value: string) {
                return value.trim();
              },
            },
            {
              validator: async (_rule, value: string) => {
                const keys = Object.keys(tags).filter((f) =>
                  'id' in formData! ? f !== formData.name : true,
                );
                if (keys.includes(value)) {
                  return Promise.reject('标签名称已存在');
                }
              },
            },
          ]}
        >
          <Input ref={inputRef} placeholder="请输入标签名称" />
        </Form.Item>

        <Form.Item<List>
          label="标签颜色"
          name="color"
          rules={[
            { required: true, message: '标签颜色不可省略!' },
            {
              validator: async (_rule, value: string) => {
                const colors = Object.values(tags)
                  .map((f) => f.color)
                  .filter((f) =>
                    'id' in formData! ? f !== formData.color : true,
                  );
                if (colors.includes(value)) {
                  return Promise.reject('标签颜色已存在');
                }
              },
            },
          ]}
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
