/**
 * 图片压缩工具核心逻辑
 * 使用Canvas API实现图片压缩，支持多种图片格式
 */

class ImageCompressor {
    /**
     * 创建图片压缩器实例
     * @param {Object} options - 配置选项
     * @param {Number} options.quality - 压缩质量 (0-1)
     * @param {String} options.type - 输出图片类型 (默认保持原格式)
     * @param {Number} options.maxWidth - 最大宽度 (可选)
     * @param {Number} options.maxHeight - 最大高度 (可选)
     * @param {Boolean} options.preserveTransparency - 是否保留透明度 (默认 true)
     */
    constructor(options = {}) {
        this.options = {
            quality: options.quality || 0.8,
            type: options.type || null,
            maxWidth: options.maxWidth || null,
            maxHeight: options.maxHeight || null,
            preserveTransparency: options.preserveTransparency !== false
        };
        
        // 支持的图片类型
        this.supportedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    }
    
    /**
     * 压缩单个图片
     * @param {File|Blob} file - 要压缩的图片文件
     * @returns {Promise<Object>} - 返回包含压缩结果的Promise
     */
    compress(file) {
        return new Promise((resolve, reject) => {
            // 检查文件类型
            if (!file || !file.type.startsWith('image/')) {
                reject(new Error('不支持的文件类型，请上传图片文件'));
                return;
            }
            
            // 对于SVG文件，直接返回原文件
            if (file.type === 'image/svg+xml') {
                resolve({
                    file: file,
                    originalSize: file.size,
                    compressedSize: file.size,
                    name: file.name,
                    type: file.type,
                    compressionRatio: 1,
                    quality: 1
                });
                return;
            }
            
            // 创建文件读取器
            const reader = new FileReader();
            
            reader.onload = (event) => {
                // 创建图片对象
                const img = new Image();
                img.onload = () => {
                    // 计算新的尺寸
                    const dimensions = this._calculateDimensions(img);
                    
                    // 创建Canvas
                    const canvas = document.createElement('canvas');
                    canvas.width = dimensions.width;
                    canvas.height = dimensions.height;
                    
                    // 绘制图片到Canvas
                    const ctx = canvas.getContext('2d');
                    
                    // 如果是PNG或WebP且需要保留透明度
                    if ((file.type === 'image/png' || file.type === 'image/webp') && this.options.preserveTransparency) {
                        ctx.clearRect(0, 0, canvas.width, canvas.height);
                    } else {
                        ctx.fillStyle = '#FFFFFF';
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                    }
                    
                    // 绘制图片
                    ctx.drawImage(img, 0, 0, dimensions.width, dimensions.height);
                    
                    // 确定输出类型
                    const outputType = this.options.type || file.type;
                    
                    // 转换Canvas为Blob
                    canvas.toBlob((blob) => {
                        if (!blob) {
                            reject(new Error('图片压缩失败'));
                            return;
                        }
                        
                        // 创建新的文件名
                        const fileName = this._getCompressedFileName(file.name);
                        
                        // 创建新的File对象
                        const compressedFile = new File([blob], fileName, {
                            type: outputType,
                            lastModified: new Date().getTime()
                        });
                        
                        // 计算压缩比例
                        const compressionRatio = file.size / compressedFile.size;
                        
                        // 返回结果
                        resolve({
                            file: compressedFile,
                            originalSize: file.size,
                            compressedSize: compressedFile.size,
                            name: fileName,
                            type: outputType,
                            width: dimensions.width,
                            height: dimensions.height,
                            compressionRatio: compressionRatio,
                            quality: this.options.quality
                        });
                    }, outputType, this.options.quality);
                };
                
                img.onerror = () => {
                    reject(new Error('图片加载失败'));
                };
                
                // 设置图片源
                img.src = event.target.result;
            };
            
            reader.onerror = () => {
                reject(new Error('文件读取失败'));
            };
            
            // 读取文件为DataURL
            reader.readAsDataURL(file);
        });
    }
    
    /**
     * 批量压缩图片
     * @param {Array<File>} files - 要压缩的图片文件数组
     * @param {Function} progressCallback - 进度回调函数
     * @returns {Promise<Array<Object>>} - 返回包含所有压缩结果的Promise
     */
    compressAll(files, progressCallback = null) {
        return new Promise((resolve, reject) => {
            const results = [];
            let processed = 0;
            
            // 检查文件数量
            if (!files || files.length === 0) {
                reject(new Error('没有选择文件'));
                return;
            }
            
            // 过滤出图片文件
            const imageFiles = Array.from(files).filter(file => 
                file.type.startsWith('image/') || file.type === 'image/svg+xml'
            );
            
            if (imageFiles.length === 0) {
                reject(new Error('没有可用的图片文件'));
                return;
            }
            
            // 处理每个文件
            imageFiles.forEach((file, index) => {
                this.compress(file)
                    .then(result => {
                        results[index] = result;
                        processed++;
                        
                        // 调用进度回调
                        if (progressCallback) {
                            progressCallback(processed / imageFiles.length, result);
                        }
                        
                        // 所有文件处理完成
                        if (processed === imageFiles.length) {
                            resolve(results);
                        }
                    })
                    .catch(error => {
                        results[index] = {
                            error: error.message,
                            name: file.name
                        };
                        processed++;
                        
                        // 调用进度回调
                        if (progressCallback) {
                            progressCallback(processed / imageFiles.length, { error: error.message, name: file.name });
                        }
                        
                        // 所有文件处理完成
                        if (processed === imageFiles.length) {
                            resolve(results);
                        }
                    });
            });
        });
    }
    
    /**
     * 更新压缩选项
     * @param {Object} options - 新的配置选项
     */
    updateOptions(options = {}) {
        this.options = {
            ...this.options,
            ...options
        };
    }
    
    /**
     * 计算新的图片尺寸，保持宽高比
     * @private
     * @param {Image} img - 图片对象
     * @returns {Object} - 返回新的宽高
     */
    _calculateDimensions(img) {
        let { width, height } = img;
        const { maxWidth, maxHeight } = this.options;
        
        // 如果设置了最大宽度且图片宽度超过最大宽度
        if (maxWidth && width > maxWidth) {
            height = (maxWidth / width) * height;
            width = maxWidth;
        }
        
        // 如果设置了最大高度且图片高度超过最大高度
        if (maxHeight && height > maxHeight) {
            width = (maxHeight / height) * width;
            height = maxHeight;
        }
        
        return {
            width: Math.floor(width),
            height: Math.floor(height)
        };
    }
    
    /**
     * 生成压缩后的文件名
     * @private
     * @param {String} originalName - 原始文件名
     * @returns {String} - 返回新的文件名
     */
    _getCompressedFileName(originalName) {
        const lastDotIndex = originalName.lastIndexOf('.');
        if (lastDotIndex === -1) {
            return `${originalName}-compressed`;
        }
        
        const nameWithoutExt = originalName.substring(0, lastDotIndex);
        const extension = originalName.substring(lastDotIndex);
        
        return `${nameWithoutExt}-compressed${extension}`;
    }
    
    /**
     * 格式化文件大小
     * @static
     * @param {Number} bytes - 字节数
     * @param {Number} decimals - 小数位数
     * @returns {String} - 格式化后的大小字符串
     */
    static formatSize(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }
    
    /**
     * 检查浏览器是否支持图片压缩
     * @static
     * @returns {Boolean} - 是否支持
     */
    static isSupported() {
        return (
            typeof window !== 'undefined' &&
            typeof document !== 'undefined' &&
            typeof HTMLCanvasElement !== 'undefined' &&
            !!HTMLCanvasElement.prototype.toBlob
        );
    }
}

// 导出压缩器类
window.ImageCompressor = ImageCompressor; 