const fs = require('fs');
const path = require('path');
const { minify } = require('terser');

const outDir = path.join(__dirname, '../out');

async function minifyFiles() {
    const files = ['config.js', 'extension.js', 'statusBarManager.js', 'stockDatabase.js', 'stockDataService.js', 'utils.js'];
    
    for (const file of files) {
        const filePath = path.join(outDir, file);
        if (!fs.existsSync(filePath)) {
            console.log(`跳过 ${file}（文件不存在）`);
            continue;
        }
        
        try {
            const code = fs.readFileSync(filePath, 'utf8');
            const result = await minify(code, {
                compress: {
                    drop_console: false, // 保留 console 用于调试
                    passes: 2
                },
                format: {
                    comments: false // 移除注释
                },
                keep_classnames: true, // 保持类名
                keep_fnames: true // 保持函数名（VS Code 扩展需要）
            });
            
            if (result.code) {
                fs.writeFileSync(filePath, result.code);
                console.log(`✓ 压缩完成: ${file}`);
            }
        } catch (error) {
            console.error(`压缩 ${file} 失败:`, error.message);
        }
    }
}

minifyFiles().catch(console.error);

