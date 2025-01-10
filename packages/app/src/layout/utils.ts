import dayjs from 'dayjs';
import { store } from '@/store/store';

export function getRandomColor() {
  const letters = '0123456789ABCDEF';
  let color = '#';
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}

export function printAllDates(
  startDate: dayjs.ConfigType,
  endDate: dayjs.ConfigType,
) {
  // 将开始时间和结束时间转换为 dayjs 对象
  const start = dayjs(startDate);
  const end = dayjs(endDate);
  const time: Array<dayjs.Dayjs> = [];
  // 使用一个循环从开始时间到结束时间遍历
  let currentDate = start;
  while (currentDate.isBefore(end) || currentDate.isSame(end, 'day')) {
    time.push(currentDate);
    // 增加一天
    currentDate = currentDate.add(1, 'day');
  }
  return time;
}

/**
 * 是否为节假日或者休息日
 *
 * @param {dayjs.ConfigType} time
 */
export const isHoliday = (time: dayjs.ConfigType) => {
  const year = dayjs(time).year();
  const {
    holiday: { holidays },
  } = store.getState();
  const data = holidays[year];
  const find = data.days.find((f) => dayjs(f.date).isSame(time, 'day'));
  // 如果不在列表，且是周六周日则返回true
  if (!find && [0, 6].includes(dayjs(time).day())) {
    return true;
  }
  if (!find) {
    return false;
  }
  return find.isOffDay;
};
