import os
from pathlib import Path

import win32com.client as win32


PROJECT_ROOT = Path(__file__).resolve().parents[2]
TEMPLATE_PATH = PROJECT_ROOT / "paper" / "docs" / "2026毕设答辩PPT模板FromZTZ.ppt"
OUTPUT_PATH = PROJECT_ROOT / "paper" / "docs" / "2026毕设答辩_智能记忆聊天助手_生成版.pptx"
IMGS_DIR = PROJECT_ROOT / "paper" / "imgs"


SLIDES = [
    {
        "title": "基于大语言模型的智能记忆聊天助手设计与实现",
        "subtitle": "本科毕业设计答辩\n作者：陈郁  学号：2022433020102\n指导教师：__________",
    },
    {
        "title": "目录",
        "bullets": [
            "1. 选题背景与研究意义",
            "2. 需求分析与可行性",
            "3. 系统总体架构与关键设计",
            "4. 核心功能实现",
            "5. 系统测试与结果分析",
            "6. 总结与展望",
        ],
    },
    {
        "title": "研究背景",
        "bullets": [
            "当前聊天助手多停留在“问答”层面，缺少对用户工作过程的持续感知。",
            "仅依赖文字上下文时，助手难以还原“刚刚发生了什么”。",
            "用户希望助手不仅能答复，还能记住信息、触发提醒并联动桌面能力。",
            "因此需要一个可落地、可验证的个人场景智能助手原型。",
        ],
    },
    {
        "title": "研究目标与创新点",
        "bullets": [
            "构建“对话 + 记忆 + 提醒 + 截图轨迹 + OCR + 资料夹”一体化系统。",
            "将截图轨迹引入对话链路，支持基于证据的回答与回溯。",
            "采用本地兜底机制，后端波动时仍保持核心功能可用。",
            "形成可复用的桌面智能助手工程实现方案。",
        ],
    },
    {
        "title": "需求分析（六大模块）",
        "bullets": [
            "智能对话与记忆管理",
            "提醒事项管理",
            "定时问候与通知服务",
            "截图轨迹与OCR能力",
            "AI资料夹管理",
            "前端交互与导航",
        ],
    },
    {
        "title": "可行性分析",
        "bullets": [
            "经济可行：基于开源栈与本地部署，成本可控。",
            "技术可行：Electron、React、FastAPI、SQLite 技术成熟。",
            "运行可行：单机运行链路完整，弱网场景支持降级与容错。",
            "实施可行：模块边界清晰，便于分阶段开发与验证。",
        ],
    },
    {
        "title": "系统总体架构",
        "bullets": [
            "前端层：React + TypeScript + Ant Design，负责界面交互。",
            "主进程层：Electron 负责 IPC 编排、系统能力调用与安全边界。",
            "服务层：FastAPI + SQLite + APScheduler + WebSocket + OCR。",
            "数据流：用户输入 -> 编排处理 -> 服务执行 -> 结构化反馈。",
        ],
        "image": "系统架构图.png",
    },
    {
        "title": "核心技术栈",
        "bullets": [
            "桌面端：Electron Forge、React 19、React Router、Vite",
            "后端：FastAPI、Uvicorn、SQLite、APScheduler、WebSocket",
            "智能能力：OpenAI-compatible API、PaddleOCR",
            "工程能力：IPC 安全桥接、JSON/SQLite 持久化、容错降级",
        ],
    },
    {
        "title": "智能对话与记忆模块",
        "bullets": [
            "支持连续多轮对话，结合近期历史提升上下文一致性。",
            "支持清空、查询、删除历史消息，便于管理对话记忆。",
            "支持默认人设与用户覆盖人设，提供恢复默认能力。",
            "对话中注入本地时间语义，降低时间相关回答偏差。",
        ],
        "image": "核心对话流程图.png",
    },
    {
        "title": "提醒与通知模块",
        "bullets": [
            "支持提醒创建、查询、删除与自然语言抽取。",
            "对重复提醒、过期提醒做前置拦截与提示。",
            "后端 APScheduler 到点触发，WebSocket 推送到桌面端。",
            "通知结果归档到对话记忆，便于后续回溯。",
        ],
        "image": "提醒功能流程图.png",
    },
    {
        "title": "截图轨迹与 OCR 模块",
        "bullets": [
            "支持立即截图与定时截图，支持时间窗口与区域框选。",
            "截图送后端 OCR 识别并入库，形成可检索行为轨迹。",
            "支持关键词、时间范围、状态筛选与记录清理。",
            "后端不可达时写入本地兜底记录，保证轨迹不断档。",
        ],
        "image": "截图与ORC流程图.png",
    },
    {
        "title": "AI资料夹模块",
        "bullets": [
            "支持受控目录文件列表、读取预览与删除操作。",
            "对话侧可通过工具调用进行读写删联动。",
            "所有路径需通过校验，避免越权访问风险。",
            "实现“资料管理 + 对话使用”的闭环体验。",
        ],
        "image": "AI资料夹流程图.png",
    },
    {
        "title": "前端导航与系统集成",
        "bullets": [
            "主功能区包含首页、对话、历史、提醒、截图等页面。",
            "统一壳层提供侧栏导航和布局约束。",
            "支持托盘与系统通知触发路由跳转。",
            "通过 Preload 暴露受控能力，隔离渲染层高权限访问。",
        ],
        "image": "渲染层调用主进程流程图.png",
    },
    {
        "title": "关键工程设计",
        "bullets": [
            "轻量规则门控 + 模型抽取，降低误触发和处理成本。",
            "工具调用闭环：理解意图 -> 执行工具 -> 回填结果 -> 生成答复。",
            "主流程容错：异常可降级、关键状态可恢复、错误可观测。",
            "数据落盘：记忆、人设、提醒、截图支持持久化管理。",
        ],
    },
    {
        "title": "实验场景设计",
        "bullets": [
            "场景A：提醒创建与到点通知链路验证。",
            "场景B：截图采集、OCR入库、轨迹检索验证。",
            "场景C：对话联动截图证据，回答报错回溯问题。",
            "场景D：关闭 PaddleOCR 验证本地兜底与状态反馈。",
        ],
    },
    {
        "title": "测试结果（功能正确性）",
        "bullets": [
            "立即截图与定时截图均可稳定触发并写入记录。",
            "OCR 正常时可提取主要文本，异常时可返回状态说明。",
            "检索可按关键词、时间范围、状态过滤并返回时间线摘要。",
            "对话可在证据不足时明确说明不确定性，降低无依据生成。",
        ],
        "image": "OCR异常测试.png",
    },
    {
        "title": "测试结果（稳定性与容错）",
        "bullets": [
            "后端不可用时，提醒与截图模块可本地兜底，不致整体失效。",
            "环境加载异常不阻塞 IPC 注册，避免界面无 handler 错误。",
            "工具调用设置轮次上限，避免异常循环。",
            "长时间运行下模块协同稳定，满足原型验证目标。",
        ],
        "image": "OCR报错时助手回复.png",
    },
    {
        "title": "不足与改进方向",
        "bullets": [
            "OCR 质量受截图清晰度与复杂背景影响，需进一步优化预处理。",
            "当前检索以关键词为主，语义检索能力仍有提升空间。",
            "存储层仍偏原型化，后续可统一到更完整的数据服务。",
            "自动化测试、监控与性能度量体系需继续完善。",
        ],
    },
    {
        "title": "总结",
        "bullets": [
            "完成了智能记忆聊天助手原型的设计、实现与联调验证。",
            "实现了“对话 + 轨迹证据 + 工具执行”闭环能力。",
            "证明了桌面个人场景中该方案的可行性与实用价值。",
            "为后续产品化与功能扩展提供了工程基础。",
        ],
    },
    {
        "title": "致谢",
        "bullets": [
            "感谢指导老师在选题、实现与论文写作中的指导。",
            "感谢各位评审老师的审阅与建议。",
            "答辩完毕，恳请批评指正。",
        ],
    },
]


def set_title(slide, text: str) -> None:
    if slide.Shapes.HasTitle:
        slide.Shapes.Title.TextFrame.TextRange.Text = text
        return
    textbox = slide.Shapes.AddTextbox(1, 40, 20, 860, 60)
    textbox.TextFrame.TextRange.Text = text


def set_body(slide, body_text: str) -> None:
    for i in range(1, slide.Shapes.Count + 1):
        shape = slide.Shapes(i)
        if not shape.HasTextFrame:
            continue
        # Skip title placeholder if present
        if slide.Shapes.HasTitle and shape.Name == slide.Shapes.Title.Name:
            continue
        try:
            if shape.Type == 14 or shape.PlaceholderFormat.Type in (2, 7):
                shape.TextFrame.TextRange.Text = body_text
                return
        except Exception:
            # Some shapes do not expose PlaceholderFormat.Type
            pass
    textbox = slide.Shapes.AddTextbox(1, 70, 120, 820, 360)
    textbox.TextFrame.TextRange.Text = body_text


def add_image(slide, image_name: str) -> None:
    image_path = IMGS_DIR / image_name
    if not image_path.exists():
        return
    # Keep image in lower half to avoid covering text.
    slide.Shapes.AddPicture(
        str(image_path),
        False,
        True,
        520,
        220,
        360,
        250,
    )


def build_presentation() -> None:
    if not TEMPLATE_PATH.exists():
        raise FileNotFoundError(f"Template not found: {TEMPLATE_PATH}")

    app = win32.DispatchEx("PowerPoint.Application")
    app.Visible = True
    presentation = None
    out_presentation = None
    try:
        presentation = app.Presentations.Open(str(TEMPLATE_PATH))
        # Save as pptx first to preserve theme/style.
        presentation.SaveAs(str(OUTPUT_PATH), 24)  # ppSaveAsOpenXMLPresentation
        presentation.Close()

        out_presentation = app.Presentations.Open(str(OUTPUT_PATH))
        while out_presentation.Slides.Count > 0:
            out_presentation.Slides(1).Delete()

        for idx, slide_data in enumerate(SLIDES, start=1):
            layout_index = 1 if idx == 1 else 2
            slide = out_presentation.Slides.AddSlide(
                out_presentation.Slides.Count + 1,
                out_presentation.Designs(1).SlideMaster.CustomLayouts(layout_index),
            )
            set_title(slide, slide_data["title"])

            body_lines = []
            if "subtitle" in slide_data:
                body_lines.append(slide_data["subtitle"])
            if "bullets" in slide_data:
                body_lines.extend([f"• {b}" for b in slide_data["bullets"]])
            if body_lines:
                set_body(slide, "\n".join(body_lines))
            if "image" in slide_data:
                add_image(slide, slide_data["image"])

        out_presentation.Save()
        print(f"Generated: {OUTPUT_PATH}")
        print(f"Total slides: {out_presentation.Slides.Count}")
    finally:
        if out_presentation is not None:
            out_presentation.Close()
        app.Quit()


if __name__ == "__main__":
    build_presentation()
