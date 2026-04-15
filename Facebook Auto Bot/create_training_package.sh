#!/bin/bash

# Facebook Auto Bot 培训材料包创建脚本
# 版本: v1.0
# 创建日期: 2026-04-13

set -e

echo "========================================="
echo "Facebook Auto Bot 培训材料包创建工具"
echo "========================================="

# 创建临时目录
TEMP_DIR="/tmp/fbautobot_training_$(date +%Y%m%d_%H%M%S)"
OUTPUT_DIR="/workspace"
PACKAGE_NAME="TRAINING_MATERIALS_PACKAGE"

echo "创建临时目录: $TEMP_DIR"
mkdir -p "$TEMP_DIR"

echo "创建目录结构..."
mkdir -p "$TEMP_DIR/DEMO_VIDEOS"
mkdir -p "$TEMP_DIR/TRAINING_DOCUMENTS/new_user"
mkdir -p "$TEMP_DIR/TRAINING_DOCUMENTS/intermediate_user"
mkdir -p "$TEMP_DIR/TRAINING_DOCUMENTS/advanced_user"
mkdir -p "$TEMP_DIR/TRAINING_DOCUMENTS/presentations"

echo "复制培训材料..."

# 复制视频脚本
echo "复制视频脚本..."
cp /workspace/DEMO_VIDEOS/VIDEO_SCRIPTS.md "$TEMP_DIR/DEMO_VIDEOS/"

# 复制培训文档
echo "复制新用户培训文档..."
cp /workspace/TRAINING_DOCUMENTS/new_user/QUICK_START_GUIDE.md "$TEMP_DIR/TRAINING_DOCUMENTS/new_user/"

echo "复制中级用户培训文档..."
cp /workspace/TRAINING_DOCUMENTS/intermediate_user/ADVANCED_OPERATIONS.md "$TEMP_DIR/TRAINING_DOCUMENTS/intermediate_user/"

echo "复制高级用户培训文档..."
cp /workspace/TRAINING_DOCUMENTS/advanced_user/EXPERT_CONFIGURATION.md "$TEMP_DIR/TRAINING_DOCUMENTS/advanced_user/"

echo "复制培训课件..."
cp /workspace/TRAINING_DOCUMENTS/presentations/TRAINING_SLIDES.md "$TEMP_DIR/TRAINING_DOCUMENTS/presentations/"

# 复制FAQ和技术支持文档
echo "复制FAQ文档..."
cp /workspace/FAQ.md "$TEMP_DIR/"

echo "复制技术支持文档..."
cp /workspace/TECH_SUPPORT.md "$TEMP_DIR/"

# 复制材料包说明
echo "复制材料包说明..."
cp /workspace/TRAINING_MATERIALS_README.md "$TEMP_DIR/README.md"

# 创建版本信息文件
echo "创建版本信息..."
cat > "$TEMP_DIR/VERSION.md" << EOF
# Facebook Auto Bot 培训材料包版本信息

## 基本信息
- 材料包名称: Facebook Auto Bot 培训材料包
- 版本号: v1.0
- 创建日期: 2026-04-13
- 适用系统版本: Facebook Auto Bot v3.0+

## 包含内容
1. 系统演示视频脚本 (4个视频)
2. 新用户快速上手指南
3. 中级用户培训文档  
4. 高级用户培训文档
5. 培训课件演示文稿
6. 常见问题解答文档
7. 技术支持渠道说明
8. 培训材料包说明文档

## 文件清单
\`\`\`
$(find "$TEMP_DIR" -type f | sort)
\`\`\`

## 更新历史
- v1.0 (2026-04-13): 初始版本发布

## 维护信息
- 维护团队: 培训和技术文档团队
- 联系方式: training@fbautobot.com
- 文档反馈: docs-feedback@fbautobot.com
EOF

# 创建使用指南
echo "创建使用指南..."
cat > "$TEMP_DIR/USAGE_GUIDE.md" << 'EOF'
# 培训材料包使用指南

## 快速开始

### 1. 查看材料概览
首先阅读 `README.md` 文件，了解材料包的整体结构和内容。

### 2. 根据用户类型选择材料
- **新用户**: 从 `TRAINING_DOCUMENTS/new_user/QUICK_START_GUIDE.md` 开始
- **中级用户**: 查看 `TRAINING_DOCUMENTS/intermediate_user/ADVANCED_OPERATIONS.md`
- **高级用户/管理员**: 学习 `TRAINING_DOCUMENTS/advanced_user/EXPERT_CONFIGURATION.md`
- **培训师**: 使用 `TRAINING_DOCUMENTS/presentations/TRAINING_SLIDES.md`

### 3. 参考FAQ和技术支持
- 常见问题: 查看 `FAQ.md`
- 技术支持: 查看 `TECH_SUPPORT.md`

### 4. 视频制作参考
视频脚本在 `DEMO_VIDEOS/VIDEO_SCRIPTS.md` 中，包含4个视频的完整脚本。

## 培训课程设计建议

### 基础课程 (2小时)
1. 系统介绍 (15分钟) - 使用视频脚本1
2. 快速上手 (45分钟) - 使用新用户指南
3. 基础操作 (45分钟) - 演示实际操作
4. Q&A环节 (15分钟) - 参考FAQ

### 进阶课程 (3小时)
1. 高级功能 (60分钟) - 使用中级文档
2. 系统优化 (60分钟) - 性能和安全优化
3. 故障排除 (45分钟) - 使用视频脚本4
4. 实践练习 (15分钟) - 设计练习任务

### 管理员课程 (4小时)
1. 系统架构 (60分钟) - 使用高级文档
2. 运维管理 (90分钟) - 系统管理操作
3. 故障处理 (60分钟) - 高级故障排除
4. 最佳实践 (30分钟) - 管理员检查清单

## 材料定制建议

### 添加公司特定内容
1. 在培训课件中添加公司Logo和品牌元素
2. 添加公司特定的使用案例和最佳实践
3. 定制技术支持联系方式
4. 添加公司内部流程和规范

### 多语言支持
1. 翻译材料为目标语言
2. 调整示例和案例为本地化内容
3. 考虑文化差异和本地习惯
4. 测试翻译内容的准确性

### 格式转换
1. **PDF格式**: 使用pandoc或在线工具转换
   ```bash
   pandoc README.md -o README.pdf
   ```
2. **HTML格式**: 创建在线培训页面
3. **视频制作**: 根据脚本录制实际视频
4. **印刷版本**: 调整格式适合打印

## 更新和维护

### 定期更新
1. 每月检查材料是否需要更新
2. 系统更新时同步更新培训材料
3. 收集用户反馈改进材料
4. 保持与系统文档的一致性

### 版本管理
1. 使用版本号管理材料更新
2. 记录每次更新的内容和原因
3. 保留历史版本供参考
4. 通知用户重要更新

## 获取帮助

### 技术支持
- 邮箱: support@fbautobot.com
- 电话: 400-123-4567
- 在线客服: 官网右下角聊天

### 培训咨询
- 邮箱: training@fbautobot.com
- 文档反馈: docs-feedback@fbautobot.com

### 紧急问题
- 紧急电话: 400-123-4567转1
- 值班手机: 138-0013-8000
EOF

# 创建打包脚本
echo "创建打包脚本..."
cat > "$TEMP_DIR/packaging_notes.md" << 'EOF'
# 打包说明

## 打包命令
```bash
# 创建zip包
zip -r TRAINING_MATERIALS_PACKAGE.zip ./*

# 创建tar.gz包  
tar -czf TRAINING_MATERIALS_PACKAGE.tar.gz ./*

# 计算文件哈希
md5sum TRAINING_MATERIALS_PACKAGE.zip
sha256sum TRAINING_MATERIALS_PACKAGE.zip
```

## 文件结构
```
TRAINING_MATERIALS_PACKAGE/
├── README.md                 # 材料包说明
├── VERSION.md               # 版本信息
├── USAGE_GUIDE.md           # 使用指南
├── FAQ.md                   # 常见问题解答
├── TECH_SUPPORT.md          # 技术支持
├── DEMO_VIDEOS/             # 视频脚本
│   └── VIDEO_SCRIPTS.md
├── TRAINING_DOCUMENTS/      # 培训文档
│   ├── new_user/
│   │   └── QUICK_START_GUIDE.md
│   ├── intermediate_user/
│   │   └── ADVANCED_OPERATIONS.md
│   ├── advanced_user/
│   │   └── EXPERT_CONFIGURATION.md
│   └── presentations/
│       └── TRAINING_SLIDES.md
└── packaging_notes.md       # 打包说明
```

## 分发建议
1. **内部使用**: 直接使用zip包
2. **客户交付**: 创建专业包装，包含说明文档
3. **在线发布**: 提供单独文件下载
4. **培训活动**: 准备印刷版本和电子版本

## 质量检查清单
- [ ] 所有文件完整无缺失
- [ ] 版本信息正确
- [ ] 链接和引用正确
- [ ] 格式规范统一
- [ ] 无敏感信息泄露
- [ ] 文件权限正确
EOF

echo "创建压缩包..."
cd "$TEMP_DIR"
zip -r "$OUTPUT_DIR/$PACKAGE_NAME.zip" ./* > /dev/null

echo "计算文件哈希..."
cd "$OUTPUT_DIR"
MD5_HASH=$(md5sum "$PACKAGE_NAME.zip" | cut -d' ' -f1)
SHA256_HASH=$(sha256sum "$PACKAGE_NAME.zip" | cut -d' ' -f1)
FILE_SIZE=$(du -h "$PACKAGE_NAME.zip" | cut -f1)

echo "清理临时文件..."
rm -rf "$TEMP_DIR"

echo ""
echo "========================================="
echo "培训材料包创建完成！"
echo "========================================="
echo "输出文件: $OUTPUT_DIR/$PACKAGE_NAME.zip"
echo "文件大小: $FILE_SIZE"
echo "MD5哈希: $MD5_HASH"
echo "SHA256哈希: $SHA256_HASH"
echo ""
echo "包含内容:"
echo "1. 系统演示视频脚本 (4个视频)"
echo "2. 新用户快速上手指南"
echo "3. 中级用户培训文档"
echo "4. 高级用户培训文档"
echo "5. 培训课件演示文稿"
echo "6. 常见问题解答文档"
echo "7. 技术支持渠道说明"
echo "8. 完整的使用指南和版本信息"
echo ""
echo "使用说明:"
echo "1. 解压zip包查看所有材料"
echo "2. 从README.md开始了解材料结构"
echo "3. 根据用户类型选择相应的培训材料"
echo "4. 参考USAGE_GUIDE.md获取使用建议"
echo "========================================="