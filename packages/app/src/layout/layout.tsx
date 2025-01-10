import { Calendar, Layout, Space } from 'antd';
import type { Dayjs } from 'dayjs';
import { CalendarProps, Tag } from 'antd';
import React, { useMemo, useState } from 'react';
import { FormDataTag, TagActionModal } from './components/tag-action-modal';
import { selectTag } from '@/store/slice/tag';
import { useAppSelector } from '@/store/hooks';
import { Records, selectRecord } from '@/store/slice/record';
import dayjs from 'dayjs';
import { RecoedActionModal } from './components/records-action-modal';
import { LayoutSider } from './sider';
import { selectRole } from '@/store/slice/role';

const { Content } = Layout;

export const LayoutGloal = () => {
  const { tags } = useAppSelector(selectTag);
  const { records } = useAppSelector(selectRecord);
  const { currentRole } = useAppSelector(selectRole);
  // const { modal, message } = App.useApp();
  // const dispatch = useAppDispatch();

  /*
   * 返回角色选择下的所有标签
   */
  const allTag = useMemo(() => {
    return Object.values(tags).filter((f) => currentRole.includes(f.roleId));
  }, [currentRole, tags]);

  const dateCellRender = (date: Dayjs) => {
    const value = records
      .filter((item) => {
        return (
          dayjs(date).isBetween(item.startTime, item.endTime, 'day', '[]') &&
          allTag.some((f) => f.id === item.tagId)
        );
      })
      // 过滤节假期
      .filter((item) => {
        return !item.skipDate.some((f) => {
          return dayjs(f).isSame(date, 'day');
        });
      });

    return (
      <Space direction="vertical" className="w-100%">
        {value.map((item) => {
          const { color, name } = tags[item.tagId] || {};
          return (
            <React.Fragment key={item.id}>
              <Tag
                color={color}
                className="block z-1 select-none w-100%"
                title={item.content}
                onClick={(e) => {
                  e.stopPropagation();
                  setRecordedInformation(item);
                  setRecordOpen(true);
                }}
              >
                <Space align="center">
                  {!!item.content && <span>{item.content}</span>}
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
  const [formData, setFormData] = useState<FormDataTag>();
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

                setRecordedInformation({
                  endTime: date.valueOf(),
                  startTime: date.valueOf(),
                });
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
