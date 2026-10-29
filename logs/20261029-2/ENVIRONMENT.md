# 20261029-02 环境事件登记 —— 模拟器不可用（AVD 迁移后 qemu 损坏）

## 事件链
1. 首启 e2e 中发现并修复 ensurePayload 白名单漏项 → 重建 APK 后模拟器**开始反复崩溃**（C 盘 97% 满，
   qemu 临时文件写不下的典型表现）。
2. 抢救性迁移：`Medium_Phone.avd`（12GB 用户数据 qcow2）robocopy → `D:\AppData\avd\`；
   ini path 已指新位置；C 盘随之释放（68.9GB 可用）。
3. 迁移后 emulator 37.2 报 `AVD missing kernel file / cannot find kernel in system-images sub directories`
   ——kernel-ranchu 实存于 SDK system image 目录与 AVD 目录两处仍报缺失；`-sysdir/-kernel` 显式直给
   则报 `No initial system image`。判定为迁移后 qemu 配置层损坏（非工程代码问题）。

## 资产状态
- ✅ 设备用户数据（opencode DB/凭据/工作区）安全：`D:\AppData\avd\Medium_Phone.avd\userdata-qemu.img.qcow2`
- ✅ C 盘空间已恢复（根因解除）
- ⬜ qemu 层恢复路径（择一，人工执行）：
  ① Android Studio Device Manager 对该 AVD 做 Repair/重建（Wipe Data 会清用户数据——先备份 qcow2）；
  ② 升级 emulator 至最新（当前 37.2.12）后重试；
  ③ `qemu-img check/convert` 校验 qcow2 一致性后以新 AVD 挂载。

## 影响与处置
- 设备级验证（对话/看图/SAF 实机/前台服务真机面）暂停，清单见「待模拟器恢复」节；
- host 侧任务（P1 扫尾、205 探针与插件、前台服务实现与编译、109 脚本化、评估文档、107 收口）本轮照常完成。
