# 三国杀AI自动DIY

一个让AI自创三国杀武将卡的编辑器：填写武将名称，ai自动生成，进入排版，导出一张固定 `1425 × 2048` 的卡面图片。

## 运行（Web 版）

```bash
node server.js 5173
```

浏览器打开 <http://localhost:5173/>。

## 运行手机版

- 右侧Releases下载apk

## 功能介绍

- 根据武将名称，ai自动设计三国杀技能。
- ai生成后，自动获取角色对应图片（支持换一张）。
- 可在ai设计的基础上，对势力、人名、称号、图片、技能名、技能描述进行编辑。
- 支持填写“武将设计要求”。约束ai生成。

## API获取教程

### 免费大模型服务

- 接口支持OpenAI兼容协议(`/chat/completions` 接口)，以[智谱](https://www.bigmodel.cn/apikey/platform)为例。
- 点击新建API key，名称可以随便取。
- ![image-20260830172435781](C:\Users\HUIE\AppData\Roaming\Typora\typora-user-images\image-20260830172435781.png)
- 复制新建的API key，回到软件的AI配置
- API地址填“https://open.bigmodel.cn/api/paas/v4”，key填刚刚复制的，模型名可进入[体验中心](https://www.bigmodel.cn/trialcenter/modeltrial/text)挑选。（比如可选“GLM-4.5-Flash”）
- ![image-20260830173147986](C:\Users\HUIE\AppData\Roaming\Typora\typora-user-images\image-20260830173147986.png)
- 一般来说免费模型里，越蠢的模型生成速度越快，越聪明的越慢，热门模型又不稳定，按需选择。

### 免费图片服务

- 打开[接口盒子](https://www.apihz.cn/api/apihzimgbaidu.html)，点击登录/注册。
- 登录注册成功后即可复制服务ID与key

- <img src="C:\Users\HUIE\AppData\Roaming\Typora\typora-user-images\image-20260830171253639.png" alt="image-20260830171253639" style="zoom: 33%;" />
- <img src="C:\Users\HUIE\AppData\Roaming\Typora\typora-user-images\image-20260830171735795.png" alt="image-20260830171735795" style="zoom: 67%;" />
- <img src="C:\Users\HUIE\AppData\Roaming\Typora\typora-user-images\image-20260830174416796.png" style="zoom:50%;" />

## 使用提示

- AI生成时，武将名的填写可以带上作品名，如“熊出没熊大”、“火影忍者的卡卡西”、“《海贼王》路飞”。
- 最终保存时，保存成功提示较慢，可直接去相册查看。
