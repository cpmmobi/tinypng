/**
 * 图片压缩工具主要逻辑
 * 处理用户交互、图片上传、压缩和下载
 */

document.addEventListener('DOMContentLoaded', () => {
    // 检查浏览器兼容性
    if (!ImageCompressor.isSupported()) {
        showNotification('错误', '您的浏览器不支持图片压缩功能，请使用最新版本的Chrome、Firefox或Safari浏览器。', 'error');
        return;
    }
    
    // Hero section 收起/展开功能
    const hero = document.querySelector('.hero');
    const heroToggle = document.getElementById('heroToggle');
    
    // 从localStorage获取状态
    const isHeroCollapsed = localStorage.getItem('heroCollapsed') === 'true';
    if (isHeroCollapsed) {
        hero.classList.add('collapsed');
        heroToggle.style.transform = 'rotate(180deg)';
    }
    
    heroToggle.addEventListener('click', () => {
        hero.classList.toggle('collapsed');
        const isCollapsed = hero.classList.contains('collapsed');
        heroToggle.style.transform = isCollapsed ? 'rotate(180deg)' : '';
        localStorage.setItem('heroCollapsed', isCollapsed);
    });
    
    // 获取DOM元素
    const dropArea = document.getElementById('dropArea');
    const fileInput = document.getElementById('fileInput');
    const compressBtn = document.getElementById('compressBtn');
    const previewSection = document.getElementById('previewSection');
    const previewGrid = document.getElementById('previewGrid');
    const imageCount = document.getElementById('imageCount');
    const compressionControls = document.getElementById('compressionControls');
    const compressionSummary = document.getElementById('compressionSummary');
    const originalSize = document.getElementById('originalSize');
    const compressedSize = document.getElementById('compressedSize');
    const savedSize = document.getElementById('savedSize');
    const downloadAllBtn = document.getElementById('downloadAllBtn');
    const clearBtn = document.getElementById('clearBtn');
    const modeOptions = document.querySelectorAll('.mode-option');
    
    // 从本地存储获取上次选择的压缩质量，如果没有则默认为50%（超小文件模式）
    let selectedQuality = parseFloat(localStorage.getItem('selectedCompressionQuality') || '0.5');
    
    // 创建压缩器实例
    const compressor = new ImageCompressor({
        quality: selectedQuality,
        preserveTransparency: true
    });
    
    // 初始化选中的模式
    initSelectedMode();
    
    // 存储上传的文件
    let uploadedFiles = [];
    
    // 存储压缩结果
    let compressionResults = [];
    
    // 存储图片尺寸信息，用于预估压缩大小
    let imageInfos = [];
    
    // 拖放区域事件处理
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    });
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    // 拖放高亮效果
    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, () => {
            dropArea.classList.add('drag-over');
        }, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, () => {
            dropArea.classList.remove('drag-over');
        }, false);
    });
    
    // 处理文件拖放
    dropArea.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        handleFiles(files);
    }, false);
    
    // 处理文件选择
    fileInput.addEventListener('change', () => {
        const files = fileInput.files;
        handleFiles(files);
    }, false);
    
    // 处理上传的文件
    function handleFiles(files) {
        // 检查文件数量限制
        if (files.length > 100) {
            showNotification('警告', '一次最多只能上传100张图片', 'error');
            return;
        }
        
        // 过滤图片文件
        const imageFiles = Array.from(files).filter(file => 
            file.type.startsWith('image/') || file.type === 'image/svg+xml'
        );
        
        if (imageFiles.length === 0) {
            showNotification('错误', '请上传图片文件', 'error');
            return;
        }
        
        // 存储文件
        uploadedFiles = imageFiles;
        
        // 重置图片信息数组
        imageInfos = [];
        
        // 显示预览区域和控制区域
        previewSection.style.display = 'block';
        compressionControls.style.display = 'block';
        
        // 清空预览网格
        previewGrid.innerHTML = '';
        
        // 更新图片数量
        updateImageCount();
        
        // 显示压缩摘要和操作按钮区域，但先隐藏具体内容
        compressionSummary.style.display = 'flex';
        downloadAllBtn.style.display = 'none';
        clearBtn.style.display = 'block';
        
        // 显示图片预览
        imageFiles.forEach((file, index) => {
            const previewItem = createPreviewItem(file, index);
            previewGrid.appendChild(previewItem);
        });

        // 自动开始压缩
        compressor.compressAll(uploadedFiles, (progress, result) => {
            if (result) {
                const index = uploadedFiles.findIndex(file => file.name === result.name || (result.error && file.name === result.name));
                if (index !== -1) {
                    updatePreviewItem(result, index);
                }
            }
        })
        .then(results => {
            // 存储结果
            compressionResults = results;
            
            // 计算总大小
            let totalOriginalSize = 0;
            let totalCompressedSize = 0;
            
            results.forEach(result => {
                if (!result.error) {
                    totalOriginalSize += result.originalSize;
                    totalCompressedSize += result.compressedSize;
                }
            });
            
            // 更新摘要
            originalSize.textContent = ImageCompressor.formatSize(totalOriginalSize);
            compressedSize.textContent = ImageCompressor.formatSize(totalCompressedSize);
            
            const savedBytes = totalOriginalSize - totalCompressedSize;
            const savedPercentage = ((savedBytes / totalOriginalSize) * 100).toFixed(1);
            savedSize.textContent = `${ImageCompressor.formatSize(savedBytes)} (${savedPercentage}%)`;
            
            // 显示下载按钮
            downloadAllBtn.style.display = 'block';
            
            // 显示成功通知
            showNotification('成功', '图片压缩完成！', 'success');
        })
        .catch(error => {
            showNotification('错误', error.message, 'error');
        });
    }
    
    // 更新图片数量显示
    function updateImageCount() {
        const count = uploadedFiles.length;
        imageCount.textContent = count;
    }
    
    // 分析图片以获取预估压缩信息
    function analyzeImage(file, index) {
        // 对于SVG文件，不进行预估
        if (file.type === 'image/svg+xml') {
            imageInfos[index] = {
                originalSize: file.size,
                estimatedSize: file.size,
                type: file.type,
                isVector: true
            };
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                // 获取图片尺寸和类型信息
                const imageInfo = {
                    originalSize: file.size,
                    width: img.width,
                    height: img.height,
                    type: file.type,
                    isVector: false,
                    // 预估压缩比例因子 (根据图片类型和当前质量设置)
                    compressionFactor: getCompressionFactor(file.type, selectedQuality)
                };
                
                // 计算预估大小
                imageInfo.estimatedSize = estimateCompressedSize(imageInfo);
                
                // 存储图片信息
                imageInfos[index] = imageInfo;
                
                // 更新预览项显示预估大小
                updatePreviewItemEstimate(index);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
    
    // 根据图片类型和质量获取压缩比例因子
    function getCompressionFactor(type, quality) {
        // 不同类型图片的压缩效率不同
        if (type === 'image/jpeg') {
            // JPEG压缩效率较高
            return Math.pow(quality, 1.5);
        } else if (type === 'image/png') {
            // PNG压缩效率较低，特别是对于已经优化过的PNG
            // 调整算法，使得即使在90%质量下也有一定压缩
            return 0.7 + (quality * 0.3);
        } else if (type === 'image/webp') {
            // WebP压缩效率很高
            return Math.pow(quality, 1.7);
        } else {
            // 其他格式使用默认因子
            return quality;
        }
    }
    
    // 估算压缩后的大小
    function estimateCompressedSize(imageInfo) {
        if (imageInfo.isVector) {
            return imageInfo.originalSize; // 矢量图不压缩
        }
        
        // 基于原始大小、图片尺寸和压缩因子估算
        const pixelCount = imageInfo.width * imageInfo.height;
        const bitsPerPixel = (imageInfo.originalSize * 8) / pixelCount;
        
        // 应用压缩因子
        const estimatedBitsPerPixel = bitsPerPixel * imageInfo.compressionFactor;
        
        // 计算估计大小 (字节)
        let estimatedSize = (estimatedBitsPerPixel * pixelCount) / 8;
        
        // 确保估计大小不小于某个最小值，也不大于原始大小的95%
        // 即使在最高质量设置下，也至少有5%的压缩
        const minSize = imageInfo.originalSize * 0.1; // 最小为原始大小的10%
        const maxSize = imageInfo.originalSize * 0.95; // 最大为原始大小的95%
        estimatedSize = Math.max(minSize, Math.min(estimatedSize, maxSize));
        
        return Math.round(estimatedSize);
    }
    
    // 更新预览项的预估大小显示
    function updatePreviewItemEstimate(index) {
        const imageInfo = imageInfos[index];
        if (!imageInfo) return;
        
        const previewItem = document.querySelector(`.preview-item[data-index="${index}"]`);
        if (!previewItem) return;
        
        // 查找或创建预估大小元素
        let estimateElem = previewItem.querySelector('.estimated-size');
        if (!estimateElem) {
            const infoDiv = previewItem.querySelector('.preview-item-info');
            if (!infoDiv) return;
            
            // 在类型信息后添加预估大小信息
            const typeElem = infoDiv.querySelector('p:nth-child(3)');
            if (typeElem) {
                estimateElem = document.createElement('p');
                estimateElem.className = 'estimated-size';
                infoDiv.insertBefore(estimateElem, typeElem.nextSibling);
            }
        }
        
        if (estimateElem) {
            if (imageInfo.isVector) {
                estimateElem.textContent = `预估大小: 无法压缩 (矢量图)`;
            } else {
                const originalSizeFormatted = ImageCompressor.formatSize(imageInfo.originalSize);
                const estimatedSizeFormatted = ImageCompressor.formatSize(imageInfo.estimatedSize);
                const savingPercent = ((1 - imageInfo.estimatedSize / imageInfo.originalSize) * 100).toFixed(1);
                
                estimateElem.textContent = `预估大小: ${estimatedSizeFormatted} (节省 ${savingPercent}%)`;
                
                // 根据节省比例设置颜色
                if (savingPercent > 20) {
                    estimateElem.style.color = 'var(--success-color)';
                } else if (savingPercent > 5) {
                    estimateElem.style.color = '#FFA500'; // 橙色
                } else {
                    estimateElem.style.color = 'var(--text-secondary)';
                }
            }
        }
    }
    
    // 更新所有预览项的预估大小
    function updateAllEstimates() {
        imageInfos.forEach((info, index) => {
            if (info) {
                // 更新压缩因子
                info.compressionFactor = getCompressionFactor(info.type, selectedQuality);
                // 重新计算预估大小
                info.estimatedSize = estimateCompressedSize(info);
                // 更新显示
                updatePreviewItemEstimate(index);
            }
        });
    }
    
    // 创建预览项
    function createPreviewItem(file, index) {
        const previewItem = document.createElement('div');
        previewItem.className = 'preview-item';
        previewItem.id = `preview-${index}`;
        previewItem.setAttribute('data-index', index);

        const imgContainer = document.createElement('div');
        imgContainer.className = 'preview-img-container';
        
        const img = document.createElement('img');
        img.className = 'preview-img';
        img.src = URL.createObjectURL(file);
        imgContainer.appendChild(img);

        const info = document.createElement('div');
        info.className = 'preview-info';

        const title = document.createElement('h4');
        title.textContent = file.name;
        title.title = file.name;

        const fileDetails = document.createElement('div');
        fileDetails.className = 'file-details';

        // 原始大小
        const sizeDetail = document.createElement('div');
        sizeDetail.className = 'detail-item';
        sizeDetail.innerHTML = `
            <span class="detail-label">文件大小</span>
            <span class="detail-value">${formatFileSize(file.size)}</span>
        `;

        // 文件类型
        const typeDetail = document.createElement('div');
        typeDetail.className = 'detail-item';
        typeDetail.innerHTML = `
            <span class="detail-label">文件类型</span>
            <span class="detail-value">${file.type.split('/')[1].toUpperCase()}</span>
        `;

        fileDetails.appendChild(sizeDetail);
        fileDetails.appendChild(typeDetail);

        const actions = document.createElement('div');
        actions.className = 'preview-actions';
        
        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'download-btn';
        downloadBtn.textContent = '下载';
        downloadBtn.style.display = 'none';
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.textContent = '删除';
        deleteBtn.onclick = () => {
            previewGrid.removeChild(previewItem);
            uploadedFiles = uploadedFiles.filter((_, i) => i !== index);
            imageInfos = imageInfos.filter((_, i) => i !== index);
            compressionResults = compressionResults.filter((_, i) => i !== index);
            
            // 更新图片数量
            updateImageCount();
            
            if (uploadedFiles.length === 0) {
                previewSection.style.display = 'none';
                compressionSummary.style.display = 'none';
                downloadAllBtn.style.display = 'none';
                clearBtn.style.display = 'none';
            } else {
                // 重新计算压缩结果
                let totalOriginalSize = 0;
                let totalCompressedSize = 0;
                
                compressionResults.forEach(result => {
                    if (!result.error) {
                        totalOriginalSize += result.originalSize;
                        totalCompressedSize += result.compressedSize;
                    }
                });
                
                originalSize.textContent = ImageCompressor.formatSize(totalOriginalSize);
                compressedSize.textContent = ImageCompressor.formatSize(totalCompressedSize);
                
                const savedBytes = totalOriginalSize - totalCompressedSize;
                const savedPercentage = ((savedBytes / totalOriginalSize) * 100).toFixed(1);
                savedSize.textContent = `${ImageCompressor.formatSize(savedBytes)} (${savedPercentage}%)`;
            }
        };
        
        actions.appendChild(downloadBtn);
        actions.appendChild(deleteBtn);

        info.appendChild(title);
        info.appendChild(fileDetails);
        info.appendChild(actions);

        previewItem.appendChild(imgContainer);
        previewItem.appendChild(info);

        return previewItem;
    }
    
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    // 更新压缩预览项
    function updatePreviewItem(result, index) {
        const previewItem = document.querySelector(`.preview-item[data-index="${index}"]`);
        
        if (!previewItem) return;
        
        // 如果压缩失败
        if (result.error) {
            previewItem.classList.add('error');
            return;
        }
        
        // 更新图片
        const img = previewItem.querySelector('img');
        img.src = URL.createObjectURL(result.file);
        
        // 更新文件大小
        const sizeValue = previewItem.querySelector('.detail-item:first-child .detail-value');
        if (sizeValue) {
            const savedPercent = ((1 - result.compressedSize / result.originalSize) * 100).toFixed(1);
            sizeValue.innerHTML = `
                <span style="text-decoration: line-through; color: var(--light-gray); margin-right: 8px;">
                    ${formatFileSize(result.originalSize)}
                </span>
                ${formatFileSize(result.compressedSize)}
                <span style="color: var(--success-color); font-size: 12px; margin-left: 4px;">
                    (-${savedPercent}%)
                </span>
            `;
        }
        
        // 显示并更新下载按钮
        const downloadBtn = previewItem.querySelector('.download-btn');
        if (downloadBtn) {
            downloadBtn.style.display = 'block';
            downloadBtn.onclick = () => {
                const url = URL.createObjectURL(result.file);
                const a = document.createElement('a');
                a.href = url;
                a.download = result.name;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            };
        }
    }
    
    // 压缩模式选择事件
    modeOptions.forEach(option => {
        option.addEventListener('click', () => {
            // 移除所有选项的激活状态
            modeOptions.forEach(opt => opt.classList.remove('active'));
            
            // 激活当前选项
            option.classList.add('active');
            
            // 获取选中的质量值
            selectedQuality = parseInt(option.dataset.quality) / 100;
            
            // 保存选择到本地存储
            localStorage.setItem('selectedCompressionQuality', selectedQuality.toString());
            
            // 更新压缩器选项
            compressor.updateOptions({
                quality: selectedQuality
            });
            
            // 更新所有图片的预估压缩大小
            updateAllEstimates();
        });
    });
    
    // 压缩按钮事件
    compressBtn.addEventListener('click', () => {
        if (uploadedFiles.length === 0) {
            showNotification('错误', '请先上传图片', 'error');
            return;
        }
        
        // 禁用按钮，显示加载状态
        compressBtn.disabled = true;
        compressBtn.innerHTML = '<span class="loading"></span>压缩中...';
        
        // 压缩图片
        compressor.compressAll(uploadedFiles, (progress, result) => {
            // 更新进度
            compressBtn.innerHTML = `<span class="loading"></span>压缩中... ${Math.round(progress * 100)}%`;
            
            // 更新预览
            if (result) {
                const index = uploadedFiles.findIndex(file => file.name === result.name || (result.error && file.name === result.name));
                if (index !== -1) {
                    updatePreviewItem(result, index);
                }
            }
        })
        .then(results => {
            // 存储结果
            compressionResults = results;
            
            // 计算总大小
            let totalOriginalSize = 0;
            let totalCompressedSize = 0;
            
            results.forEach(result => {
                if (!result.error) {
                    totalOriginalSize += result.originalSize;
                    totalCompressedSize += result.compressedSize;
                }
            });
            
            // 更新摘要
            originalSize.textContent = ImageCompressor.formatSize(totalOriginalSize);
            compressedSize.textContent = ImageCompressor.formatSize(totalCompressedSize);
            
            const savedBytes = totalOriginalSize - totalCompressedSize;
            const savedPercentage = ((savedBytes / totalOriginalSize) * 100).toFixed(1);
            savedSize.textContent = `${ImageCompressor.formatSize(savedBytes)} (${savedPercentage}%)`;
            
            // 显示摘要和下载按钮
            compressionSummary.style.display = 'flex';
            downloadAllBtn.style.display = 'block';
            
            // 恢复按钮状态
            compressBtn.disabled = false;
            compressBtn.textContent = '重新压缩';
            
            // 显示成功通知
            showNotification('成功', '图片压缩完成！', 'success');
            
            // 滚动到预览区域
            previewSection.scrollIntoView({ behavior: 'smooth' });
        })
        .catch(error => {
            // 恢复按钮状态
            compressBtn.disabled = false;
            compressBtn.textContent = '压缩图片';
            
            // 显示错误通知
            showNotification('错误', error.message, 'error');
        });
    });
    
    // 下载所有按钮事件
    downloadAllBtn.addEventListener('click', () => {
        if (compressionResults.length === 0) {
            showNotification('错误', '没有可下载的图片', 'error');
            return;
        }
        
        // 如果只有一张图片，直接下载
        if (compressionResults.length === 1 && !compressionResults[0].error) {
            downloadFile(compressionResults[0].file);
            return;
        }
        
        // 多张图片，使用JSZip打包下载
        downloadAllFiles();
    });
    
    // 清除按钮事件
    clearBtn.addEventListener('click', () => {
        // 清空文件和结果
        uploadedFiles = [];
        compressionResults = [];
        imageInfos = []; // 清空图片信息数组
        
        // 清空文件输入
        fileInput.value = '';
        
        // 隐藏控制和预览区域
        compressionControls.style.display = 'none';
        previewSection.style.display = 'none';
        
        // 清空预览网格
        previewGrid.innerHTML = '';
        
        // 重置压缩按钮
        compressBtn.disabled = false;
        compressBtn.textContent = '压缩图片';
        
        // 滚动到顶部
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    
    // 下载单个文件
    function downloadFile(file) {
        const url = URL.createObjectURL(file);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    // 下载所有文件（需要动态加载JSZip库）
    function downloadAllFiles() {
        // 检查是否已加载JSZip
        if (typeof JSZip === 'undefined') {
            // 加载JSZip库
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
            script.onload = () => {
                // 库加载完成后执行打包
                createAndDownloadZip();
            };
            script.onerror = () => {
                showNotification('错误', '无法加载压缩库，请检查网络连接', 'error');
            };
            document.head.appendChild(script);
        } else {
            // JSZip已加载，直接执行打包
            createAndDownloadZip();
        }
    }
    
    // 创建并下载ZIP文件
    function createAndDownloadZip() {
        // 显示加载状态
        downloadAllBtn.disabled = true;
        downloadAllBtn.innerHTML = '<span class="loading"></span>打包中...';
        
        // 创建新的JSZip实例
        const zip = new JSZip();
        
        // 添加文件到zip
        const promises = compressionResults
            .filter(result => !result.error)
            .map(result => {
                return new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        // 将文件内容添加到zip
                        zip.file(result.name, e.target.result.split(',')[1], { base64: true });
                        resolve();
                    };
                    reader.readAsDataURL(result.file);
                });
            });
        
        // 所有文件添加完成后生成zip
        Promise.all(promises)
            .then(() => {
                return zip.generateAsync({ type: 'blob' });
            })
            .then((blob) => {
                // 下载zip文件
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'compressed-images.zip';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                
                // 恢复按钮状态
                downloadAllBtn.disabled = false;
                downloadAllBtn.textContent = '下载全部';
                
                showNotification('成功', '所有图片已打包下载', 'success');
            })
            .catch(error => {
                console.error('打包下载失败:', error);
                
                // 恢复按钮状态
                downloadAllBtn.disabled = false;
                downloadAllBtn.textContent = '下载全部';
                
                showNotification('错误', '打包下载失败', 'error');
            });
    }
    
    // 显示通知
    function showNotification(title, message, type = 'success') {
        // 创建通知元素
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        // 创建图标
        const icon = document.createElement('div');
        icon.className = 'notification-icon';
        
        if (type === 'success') {
            icon.innerHTML = `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="#4CD964" stroke-width="2"/>
                    <path d="M8 12L11 15L16 9" stroke="#4CD964" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            `;
        } else {
            icon.innerHTML = `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="#FF3B30" stroke-width="2"/>
                    <path d="M15 9L9 15" stroke="#FF3B30" stroke-width="2" stroke-linecap="round"/>
                    <path d="M9 9L15 15" stroke="#FF3B30" stroke-width="2" stroke-linecap="round"/>
                </svg>
            `;
        }
        
        // 创建内容
        const content = document.createElement('div');
        content.className = 'notification-content';
        
        const titleElement = document.createElement('div');
        titleElement.className = 'notification-title';
        titleElement.textContent = title;
        
        const messageElement = document.createElement('div');
        messageElement.className = 'notification-message';
        messageElement.textContent = message;
        
        content.appendChild(titleElement);
        content.appendChild(messageElement);
        
        notification.appendChild(icon);
        notification.appendChild(content);
        
        // 添加到页面
        document.body.appendChild(notification);
        
        // 3秒后自动移除
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }
    
    // 根据存储的质量值初始化选中的模式
    function initSelectedMode() {
        const qualityPercent = Math.round(selectedQuality * 100);
        let found = false;
        
        modeOptions.forEach(option => {
            const optionQuality = parseInt(option.dataset.quality);
            if (optionQuality === qualityPercent) {
                // 移除所有选项的激活状态
                modeOptions.forEach(opt => opt.classList.remove('active'));
                // 激活当前选项
                option.classList.add('active');
                found = true;
            }
        });
        
        // 如果没有找到匹配的选项，默认选择超小文件模式
        if (!found) {
            modeOptions.forEach(opt => opt.classList.remove('active'));
            const defaultOption = document.querySelector('.mode-option[data-quality="50"]');
            if (defaultOption) {
                defaultOption.classList.add('active');
                selectedQuality = 0.5;
            }
        }
    }
}); 