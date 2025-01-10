import { ConfigProvider, App as GlobalApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import './App.css';
import 'dayjs/locale/zh-cn';
import { LayoutGloal } from './layout/layout';
import isBetween from 'dayjs/plugin/isBetween'; // ES 2015
import dayjs from 'dayjs';

dayjs.extend(isBetween);

const App = () => {
  return (
    <ConfigProvider
      theme={{
        cssVar: true,
        hashed: false,
        token: {
          // colorPrimary: '#67A4FA',
        },
        components: {
          Layout: {
            siderBg: '#F9F9FF',
            headerBg: '#F9F9FF',
          },
          Divider: {
            textPaddingInline: 0,
            margin: 0,
            marginLG: 0,
          },
          Calendar: {
            // paddingXS: 0,
            // marginXS: 0,
          },
        },
      }}
      locale={zhCN}
    >
      <GlobalApp>
        <LayoutGloal />
      </GlobalApp>
    </ConfigProvider>
  );
};

export default App;
