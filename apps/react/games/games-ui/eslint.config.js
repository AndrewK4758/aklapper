import reactRefresh from 'eslint-plugin-react-refresh';
import baseConfig from '../../../../eslint.config.js';

export default [...baseConfig, reactRefresh.configs.recommended];
