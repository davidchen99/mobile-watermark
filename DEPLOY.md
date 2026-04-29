# Cloudflare 部署

## 推荐方式

把 `mobile-web` 目录单独作为一个静态站点上传到 Cloudflare Pages。

## 目录内已包含

- `wrangler.toml`
- `_headers`
- `_redirects`

这些文件已经足够支撑一个纯静态页面部署。

## Pages 控制台参数

如果你在 Cloudflare Pages 后台手动创建项目：

1. `Framework preset` 选 `None`
2. `Build command` 留空
3. `Build output directory` 填 `/`
4. 如果你是从整个仓库连过去，建议把根目录指向 `mobile-web`

## Wrangler CLI

如果你后面想走命令行：

```powershell
cd "C:\Users\lenovo\Desktop\chen vibe coding\打水印\打水印（待压缩） 4.0 手机版\mobile-web"
wrangler pages deploy .
```

## 备注

- 这是纯前端本地处理，不依赖后端。
- Cloudflare 登录只在你正式发布时需要，现在本地改代码不需要登录。
