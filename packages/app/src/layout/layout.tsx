import { Calendar, Layout, Space } from 'antd';
import type { Dayjs } from 'dayjs';
import { CalendarProps, Tag } from 'antd';
import React, { useState } from 'react';
import { TagActionModal } from './components/tag-action-modal';
import { List, selectTag } from '@/store/slice/tag';
import { useAppSelector } from '@/store/hooks';
import { Records, selectRecord } from '@/store/slice/record';
import dayjs from 'dayjs';
import { RecoedActionModal } from './components/records-action-modal';
import { LayoutSider } from './sider';
import { selectRole } from '@/store/slice/role';

const { Content } = Layout;

export const LayoutGloal = () => {
  const { list } = useAppSelector(selectTag);
  const { records } = useAppSelector(selectRecord);
  const { currentRole } = useAppSelector(selectRole);
  // const { modal, message } = App.useApp();
  // const dispatch = useAppDispatch();

  const dateCellRender = (date: Dayjs) => {
    const value = Object.values(records)
      .filter((f) => {
        return f.some(
          (item) =>
            dayjs(date).isSame(item.time, 'day') && item.roleId === currentRole,
        );
      })
      .flat(2);

    return (
      <Space direction="vertical" className="w-100%">
        {value.map((item) => {
          const { color, name } = list[item.tagId] || {};
          return (
            <React.Fragment key={item.id}>
              <Tag
                color={color}
                className="block z-1 select-none"
                title={item.content}
                onClick={(e) => {
                  e.stopPropagation();
                  setRecordedInformation(item);
                  setRecordOpen(true);
                }}
              >
                <Space>
                  <span>{item.content}</span>
                  <span>[{name}]</span>
                </Space>
              </Tag>
            </React.Fragment>
          );
        })}
      </Space>
    );
  };

  const cellRender: CalendarProps<Dayjs>['cellRender'] = (current, info) => {
    // console.log({ current, info });

    if (info.type === 'date') return dateCellRender(current);
    // if (info.type === 'month') return monthCellRender(current);
    return null;
  };

  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState<List>();
  const [recordOpen, setRecordOpen] = useState(false);
  const [recordedInformation, setRecordedInformation] = useState<
    Partial<Records>
  >({});

  return (
    <>
      <Layout>
        <Layout>
          <LayoutSider
            setOpen={setOpen}
            setFormData={setFormData}
          ></LayoutSider>
          <Content>
            <Calendar
              className="p-12px"
              onSelect={(date, { source }) => {
                if (source !== 'date') {
                  return;
                }

                setRecordedInformation({ time: date.valueOf() });
                setRecordOpen(true);
              }}
              cellRender={cellRender}
            />
          </Content>
        </Layout>
      </Layout>
      <TagActionModal
        open={open}
        setOpen={setOpen}
        formData={formData}
        setFormData={setFormData}
      ></TagActionModal>
      <RecoedActionModal
        open={recordOpen}
        setOpen={setRecordOpen}
        recordedInformation={recordedInformation}
        setRecordedInformation={setRecordedInformation}
      ></RecoedActionModal>
    </>
  );
};
