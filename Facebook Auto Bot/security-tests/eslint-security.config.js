// 安全专用的ESLint配置
module.exports = {
  parser: '@typescript-eslint/parser',
  plugins: [
    '@typescript-eslint',
    'security',
    'no-unsanitized'
  ],
  extends: [
    'plugin:security/recommended',
    'plugin:@typescript-eslint/recommended'
  ],
  rules: {
    // 安全相关规则
    'security/detect-object-injection': 'error',
    'security/detect-possible-timing-attacks': 'error',
    'security/detect-non-literal-require': 'error',
    'security/detect-non-literal-regexp': 'error',
    'security/detect-unsafe-regex': 'error',
    'security/detect-buffer-noassert': 'error',
    'security/detect-child-process': 'error',
    'security/detect-disable-mustache-escape': 'error',
    'security/detect-eval-with-expression': 'error',
    'security/detect-no-csrf-before-method-override': 'error',
    'security/detect-pseudoRandomBytes': 'error',
    
    // 输入验证规则
    'no-unsanitized/method': 'error',
    'no-unsanitized/property': 'error',
    
    // SQL注入防护
    '@typescript-eslint/no-explicit-any': 'error',
    
    // XSS防护
    'security/detect-bidi-characters': 'error',
    
    // 密码安全
    'security/detect-weak-crypto': 'error',
    
    // 会话安全
    'security/detect-no-hardcoded-credentials': 'error',
    
    // 文件上传安全
    'security/detect-unsafe-filesystem': 'error',
    
    // 环境变量安全
    'security/detect-unsafe-env': 'error',
  },
  overrides: [
    {
      files: ['*.spec.ts', '*.test.ts'],
      rules: {
        'security/detect-object-injection': 'off',
        'security/detect-possible-timing-attacks': 'off',
      },
    },
  ],
};