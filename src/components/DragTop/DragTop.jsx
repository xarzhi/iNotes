import { useCallback, useRef, useState } from 'react'
import './index.scss'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useNavigate, useLocation } from 'react-router-dom'
import { create, BaseDirectory } from '@tauri-apps/plugin-fs'
import { randomNoteTheme } from '@/utils/theme'
import { useNote } from '@/context/NoteContext.jsx'
import NoteDialog from '@/components/NoteDialog/NoteDialog.jsx'
import { listNoteTitles, nextUntitledName, notePathFor, sanitizeTitle, uniqueTitle } from '@/utils/noteFile'

const BackBtn = ({ onAdd }) => {
	const location = useLocation()
	const navigate = useNavigate()

	const { pathname } = location
	const jump = path => navigate(path)

	// 「+」新增便签：列表页和设置页都保留，点了先弹新建对话框
	const addBtn = (
		<div className="titlebar-button" id="titlebar-maximize" onClick={onAdd}>
			<i className="iconfont icon-jia2" alt="新增" title="新建便签"></i>
		</div>
	)

	const btnMap = new Map([
		['/', { element: addBtn }],
		['/setting', { element: addBtn }],
		[
			'/note',
			{
				element: (
					<div onClick={() => jump('/')} className="titlebar-button" id="titlebar-maximize">
						<i className="iconfont icon-fanhui" alt="返回" title="返回"></i>
					</div>
				),
			},
		],
	])
	return btnMap.get(pathname)?.element || <></>
}

const DragTop = () => {
	const navigate = useNavigate()
	const window = getCurrentWindow()
	const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(false)
	const location = useLocation()
	const { pathname } = location

	// 当前便签的标题（放在 top 中间，点一下可以改）
	const { path: notePath, title, renameNote } = useNote()
	const [editingTitle, setEditingTitle] = useState(false)
	const [draftTitle, setDraftTitle] = useState('')
	const titleInputRef = useRef(null)
	const cancelEditRef = useRef(false)

	const [dialogOpen, setDialogOpen] = useState(false)

	const startEditTitle = () => {
		if (!notePath) return
		cancelEditRef.current = false
		setDraftTitle(title)
		setEditingTitle(true)
		setTimeout(() => {
			titleInputRef.current?.focus()
			titleInputRef.current?.select()
		}, 0)
	}

	const commitTitle = async () => {
		setEditingTitle(false)

		// Esc 取消：此时 draft 还是改过的值，靠这个标记区分
		if (cancelEditRef.current) {
			cancelEditRef.current = false
			return
		}

		try {
			await renameNote(draftTitle)
		} catch (e) {
			console.error('[inotes] 重命名便签失败', e)
		}
	}

	// 新建便签：按对话框里的标题 + 类型创建文件
	const createNote = useCallback(
		async ({ title: rawTitle, isTemp }) => {
			const used = new Set(await listNoteTitles())
			const typed = sanitizeTitle(rawTitle)
			const finalTitle = uniqueTitle(typed || nextUntitledName(used), used)
			const path = notePathFor(finalTitle, isTemp)

			await create(path, { baseDir: BaseDirectory.Resource })

			setDialogOpen(false)
			navigate('/note', {
				state: {
					noteInfo: { path },
					// 新建便签时随机挑一个主题色
					noteTheme: randomNoteTheme(),
				},
			})
		},
		[navigate]
	)

	// 窗口置于顶层
	const setOnTop = useCallback(async () => {
		const isAlwaysOnTop = await window.isAlwaysOnTop()
		await window.setAlwaysOnTop(!isAlwaysOnTop)
		setIsAlwaysOnTop(!isAlwaysOnTop)
	}, [])

	// 窗口最小化
	const minimize = useCallback(() => {
		window.minimize()
	}, [])
	// 窗口最大化;
	const toggleMaximize = useCallback(() => {
		window.toggleMaximize()
	}, [])
	// 关闭窗口
	const close = useCallback(async () => {
		await window.close()
	}, [])

	return (
		<>
			<div data-tauri-drag-region className="titlebar">
				<div className="left">
					<BackBtn onAdd={() => setDialogOpen(true)} />
					<div className="titlebar-button" id="titlebar-minimize" onClick={setOnTop}>
						<i
							className="iconfont icon-pin-fill"
							style={{
								color: isAlwaysOnTop ? 'blue' : 'gray',
							}}
							title="置于顶层"
						></i>
					</div>
					{/* 置顶按钮右边这个位置：列表页是「设置」，进了设置页就地变成「home」 */}
					{pathname === '/' || pathname === '/setting' ? (
						<div
							className="titlebar-button"
							id="titlebar-setting"
							onClick={() => navigate(pathname === '/' ? '/setting' : '/')}
						>
							<i
								className={`iconfont ${pathname === '/' ? 'icon-setting3' : 'icon-home'}`}
								alt={pathname === '/' ? '设置' : '返回首页'}
								title={pathname === '/' ? '设置' : '返回首页'}
							></i>
						</div>
					) : null}
				</div>

				{/* 便签标题：显示在正中间，点一下改名 */}
				<div className="middle">
					{notePath ? (
						editingTitle ? (
							<input
								ref={titleInputRef}
								className="middle_input"
								value={draftTitle}
								maxLength={40}
								aria-label="便签标题"
								onChange={event => setDraftTitle(event.target.value)}
								onBlur={commitTitle}
								onKeyDown={event => {
									if (event.key === 'Enter') {
										event.preventDefault()
										commitTitle()
									} else if (event.key === 'Escape') {
										event.preventDefault()
										cancelEditRef.current = true
										titleInputRef.current?.blur()
									}
								}}
							/>
						) : (
							<span className="middle_title" title={`${title}（点击改名）`} onClick={startEditTitle}>
								{title}
							</span>
						)
					) : null}
				</div>

				<div className="right">
					<div className="titlebar-button" id="titlebar-minimize" onClick={minimize}>
						<i className="iconfont icon-jian2" alt="最小化"></i>
					</div>

					<div className="titlebar-button" id="titlebar-maximize" onClick={toggleMaximize}>
						<i className="iconfont icon-jichu_quanping" alt="全屏"></i>
					</div>
					<div className="titlebar-button" id="titlebar-close" onClick={close}>
						<i className="iconfont icon-close4" alt="关闭"></i>
					</div>
				</div>
			</div>

			<NoteDialog open={dialogOpen} onCancel={() => setDialogOpen(false)} onConfirm={createNote} />
		</>
	)
}

export default DragTop
