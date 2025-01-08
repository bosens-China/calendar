import dayjs from 'dayjs';

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
