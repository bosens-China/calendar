import {
  App,
  Form,
  Input,
  Modal,
  DatePicker,
  Select,
  Badge,
  Button,
  Switch,
} from 'antd';
import { FC, useEffect, useMemo, useRef } from 'react';
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
import { selectRole } from '@/store/slice/role';
import { FestivalHoliday } from './festival-holiday/festival-holiday';
import { selectHoliday } from '@/store/slice/holiday';
import * as _ from 'lodash-es';
import { isHoliday, printAllDates } from '../utils';

const { TextArea } = Input;
const { RangePicker } = DatePicker;

interface Props {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  recordedInformation: Partial<Records>;
  setRecordedInformation: React.Dispatch<
    React.SetStateAction<Partial<Records>>
  >;
}

type FormValues = Omit<Records, 'id' | 'startTime' | 'endTime'> & {
  time: [Dayjs, Dayjs];
};

export const RecoedActionModal: FC<Props> = ({
  setOpen,
  open,
  recordedInformation,
  setRecordedInformation,
}) => {
  const [form] = Form.useForm<FormValues>();
  const { tags } = useAppSelector(selectTag);
  const { currentRole } = useAppSelector(selectRole);
  const dispatch = useAppDispatch();

  const tagOptions = useMemo(() => {
    return Object.entries(tags)
      .filter(([, { roleId }]) => {
        return currentRole.includes(roleId);
      })
      .map(([id, value]) => {
        return {
          label: <Badge color={value.color} text={value.name} />,
          value: id,
        };
      });
  }, [currentRole, tags]);

  // 记忆上一次的选择
  const rememberLast = useRef<FormValues>(null);
  const { message } = App.useApp();
  const handleOk = async () => {
    const values = await form.validateFields();

    (() => {
      const { tagId, time, selectedHoliday } = values;
      const content = values.content?.trim() || '';
      const [startTime, endTime] = time;

      // 勾选的范围日期实体化
      const remaining = printAllDates(startTime, endTime);

      const skipDate: number[] = selectedHoliday
        ? remaining.filter((f) => isHoliday(f)).map((f) => f.valueOf())
        : [];

      const obj: Records = {
        id: recordedInformation.id || uuid(),
        tagId,
        content,
        startTime: dayjs(startTime).valueOf(),
        endTime: dayjs(endTime).valueOf(),
        skipDate,
        selectedHoliday,
      };
      if (recordedInformation.id) {
        dispatch(updateRecord({ id: obj.id, data: obj }));
        message.success('已更新事项');
        return;
      }

      dispatch(addRecord(obj));

      message.success('添加事项完成');
      return;
    })();
    setOpen(false);
    rememberLast.current = values;
    setRecordedInformation({});
  };

  const handleCancel = () => {
    setOpen(false);
  };

  useEffect(() => {
    if (!open) {
      return;
    }
    form.resetFields();
    if (recordedInformation.id) {
      form.setFieldsValue({
        ...recordedInformation,
        time: [recordedInformation.startTime, recordedInformation.endTime].map(
          (f) => dayjs(f),
        ),
      });
      return;
    }

    const initialValues = {
      tagId: tagOptions.at(0)?.value,
      ...rememberLast.current,
      time: [recordedInformation.startTime, recordedInformation.endTime].map(
        (f) => dayjs(f),
      ),
    };
    /*
     * 检测标签有效性，如果没有则回滚
     */
    if (!tagOptions.some((f) => f.value === initialValues.tagId)) {
      initialValues.tagId = tagOptions.at(0)?.value;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    form.setFieldsValue(initialValues as any);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, form]);

  const title = useMemo(() => {
    return recordedInformation.id ? '编辑事项' : '添加事项';
  }, [recordedInformation.id]);

  const time = Form.useWatch('time', form);
  const { holidays } = useAppSelector(selectHoliday);

  const years = useMemo(() => {
    return _.uniq((time || []).map((f) => `${dayjs(f).year()}`));
  }, [time]);

  const remainingYears = useMemo(() => {
    if (!time) {
      return undefined;
    }
    return years.filter((f) => {
      return !holidays[f];
    });
  }, [holidays, time, years]);

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
        labelCol={{ span: 5 }}
        wrapperCol={{ span: 19 }}
        autoComplete="off"
        onFinish={handleOk}
        onFinishFailed={() => {}}
      >
        <Form.Item<FormValues>
          label="事项内容"
          name="content"
          // rules={[
          //   {
          //     required: true,
          //     message: '事项内容不可省略!',
          //     transform(value) {
          //       return value.trim();
          //     },
          //   },
          // ]}
        >
          <TextArea placeholder="请输入事项内容" />
        </Form.Item>
        <Form.Item<FormValues>
          label="关联标签"
          name="tagId"
          rules={[{ required: true, message: '关联标签不可省略!' }]}
        >
          <Select options={tagOptions} placeholder="请输入关联标签" />
        </Form.Item>
        <Form.Item<FormValues>
          label="关联时间"
          name="time"
          rules={[{ required: true, message: '关联时间不可省略!' }]}
        >
          <RangePicker />
        </Form.Item>
        <Form.Item<FormValues>
          label={
            <div>
              <div>忽略节假日</div>
              <div>（含周末）</div>
            </div>
          }
          name="selectedHoliday"
          valuePropName="checked"
          extra={
            <FestivalHoliday
              open={!!(time && remainingYears?.length)}
              years={remainingYears!}
            ></FestivalHoliday>
          }
        >
          <Switch
            disabled={!!(remainingYears && remainingYears.length)}
          ></Switch>
        </Form.Item>
      </Form>
    </Modal>
  );
};
