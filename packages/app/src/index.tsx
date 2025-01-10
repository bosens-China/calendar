import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import '@ant-design/v5-patch-for-react-19';
import '@unocss/reset/eric-meyer.css';
import { Provider } from 'react-redux';
import { persistor, store } from './store/store';
import { PersistGate } from 'redux-persist/integration/react';
import { setVersion, versionDetection } from './utils/version';

/*
 * 先检测兼容版本列表，不符合的直接清空
 */
versionDetection();
setVersion();

const rootEl = document.getElementById('root');
if (rootEl) {
  const root = ReactDOM.createRoot(rootEl);
  root.render(
    <React.StrictMode>
      <Provider store={store}>
        <PersistGate loading={null} persistor={persistor}>
          <App />
        </PersistGate>
      </Provider>
    </React.StrictMode>,
  );
}
