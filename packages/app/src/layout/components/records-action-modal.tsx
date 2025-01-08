import {
  App,
  Form,
  Input,
  Modal,
  DatePicker,
  Select,
  Badge,
  Button,
} from 'antd';
import { FC, useEffect, useMemo } from 'react';
import { selectTag } from '../../store/slice/tag';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  addRecord,
  Records,
  removeRecord,
  updateRecord,
} from '@/store/slice/record';
import dayjs, { Dayjs } from 'dayjs';
import { v6 as uuid } from 'uuid';
import { printAllDates } from '../utils';
import { selectRole } from '@/store/slice/role';

const { RangePicker } = DatePicker;
const { TextArea } = Input;

interface Props {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  recordedInformation: Partial<Records>;
  setRecordedInformation: React.Dispatch<
    React.SetStateAction<Partial<Records>>
  >;
}

export const RecoedActionModal: FC<Props> = ({
  setOpen,
  open,
  recordedInformation,
  setRecordedInformation,
}) => {
  const [form] = Form.useForm<Omit<Records, 'id'>>();
  const { list } = useAppSelector(selectTag);
  const { currentRole } = useAppSelector(selectRole);
  const dispatch = useAppDispatch();

  const tagOptions = useMemo(() => {
    return Object.entries(list)
      .filter(([, { roleId }]) => {
        return roleId === currentRole;
      })
      .map(([id, value]) => {
        return {
          label: <Badge color={value.color} text={value.name} />,
          value: id,
        };
      });
  }, [currentRole, list]);

  const { message } = App.useApp();
  const handleOk = async () => {
    const values = await form.validateFields();

    (() => {
      // 新建
      if (!recordedInformation.id) {
        const { tagId, content, time } = values;
        const t = time as unknown as Dayjs[];
        const timeList = printAllDates(t[0], t[1]);
        timeList.forEach((item) => {
          dispatch(
            addRecord({
              id: uuid(),
              tagId,
              content,
              time: dayjs(item).valueOf(),
              roleId: currentRole!,
            }),
          );
        });
        message.success('添加事项完成');
        return;
      }
      dispatch(
        updateRecord({
          id: recordedInformation.id,
          data: {
            ...values,
            time: dayjs(values.time).valueOf(),
          },
        }),
      );
      message.success('已更新事项');
      return;
    })();
    setOpen(false);
    setRecordedInformation({});
  };

  const handleCancel = () => {
    setOpen(false);
  };

  useEffect(() => {
    if (!open) {
      return;
    }
    const initialValues = {
      tag: tagOptions.at(0)?.value,
      ...recordedInformation,
      time: recordedInformation.id
        ? dayjs(recordedInformation.time)
        : [recordedInformation.time, recordedInformation.time].map((f) =>
            dayjs(f),
          ),
    };
    form.resetFields();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    form.setFieldsValue(initialValues as any);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, form]);

  const title = useMemo(() => {
    return recordedInformation.id ? '编辑事项' : '添加事项';
  }, [recordedInformation.id]);
  return (
    <Modal
      title={
        <div className="flex items-center">
          <div className="flex-1">{title}</div>
          {recordedInformation.id && (
            <Button
              className="mr-24px"
              danger
              onClick={() => {
                dispatch(removeRecord(recordedInformation.id!));
                setOpen(false);
              }}
            >
              删除当前事项
            </Button>
          )}
        </div>
      }
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
        <Form.Item<Records>
          label="事项内容"
          name="content"
          rules={[{ required: true, message: '事项内容不可省略!' }]}
        >
          <TextArea placeholder="请输入事项内容" />
        </Form.Item>
        <Form.Item<Records>
          label="关联标签"
          name="tagId"
          rules={[{ required: true, message: '关联标签不可省略!' }]}
        >
          <Select options={tagOptions} placeholder="请输入关联标签" />
        </Form.Item>
        <Form.Item<Records>
          label="关联时间"
          name="time"
          rules={[{ required: true, message: '关联时间不可省略!' }]}
        >
          {!recordedInformation.id ? <RangePicker /> : <DatePicker />}
        </Form.Item>
      </Form>
    </Modal>
  );
};
