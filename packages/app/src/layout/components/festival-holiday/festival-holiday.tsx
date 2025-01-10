import { Holiday, setHolidays } from '@/store/slice/holiday';
import { Button, App } from 'antd';
import { FC } from 'react';
import * as _ from 'lodash-es';
import { useRequest } from 'ahooks';
import { useAppDispatch } from '@/store/hooks';

interface Props {
  years: Array<string>;
  open: boolean;
}

const fetchHoliday = async (year: string) => {
  const res = await fetch(
    `https://cdn.jsdelivr.net/gh/NateScarlet/holiday-cn@master/${year}.json`,
  );
  const data = (await res.json()) as Holiday;
  if (!_.isObjectLike(data)) {
    throw new Error(`数据格式错误，下载失败。`);
  }
  return data;
};

export const FestivalHoliday: FC<Props> = ({ years, open }) => {
  const { message } = App.useApp();

  const dispatch = useAppDispatch();

  const { run, loading } = useRequest(
    () =>
      Promise.all(
        years.map((f) =>
          fetchHoliday(f).then((data) => {
            return {
              year: f,
              data,
            };
          }),
        ),
      ),
    {
      manual: true,
      onError() {
        message.error('下载失败');
      },
      onSuccess(data) {
        data.forEach(({ data, year }) => {
          dispatch(setHolidays({ year, holidays: data }));
        });
        message.success('下载完成');
      },
    },
  );

  if (!open) {
    return null;
  }
  return (
    <div>
      <div>当前年份节假期未下载：{years.join('-')}</div>
      <Button
        loading={loading}
        onClick={() => {
          run();
        }}
      >
        点击下载
      </Button>
    </div>
  );
};
