import {
  BetweenHorizontalEnd,
  BetweenHorizontalStart,
  BetweenVerticalEnd,
  BetweenVerticalStart,
  Columns3,
  Combine,
  Eraser,
  Rows3,
  Split,
  TableCellsSplit,
} from "lucide-react";
import type {
  canRunS1000dTableAction,
  runS1000dTableAction,
} from "../../lib/editor/s1000dTableCommands";

export function TableEditToolbar(props: {
  tableActionDisabled: (
    action: Parameters<typeof canRunS1000dTableAction>[1],
  ) => boolean;
  runTableAction: (action: Parameters<typeof runS1000dTableAction>[1]) => void;
}) {
  const { tableActionDisabled, runTableAction } = props;

  return (
    <>
      <div className="ietm-format-toolbar__cluster">
        <button
          type="button"
          className="ietm-icon-btn"
          disabled={tableActionDisabled("insertRowAbove")}
          onClick={() => runTableAction("insertRowAbove")}
          title="上方插入行"
          aria-label="上方插入行"
        >
          <BetweenVerticalStart size={16} aria-hidden />
        </button>
        <button
          type="button"
          className="ietm-icon-btn"
          disabled={tableActionDisabled("insertRowBelow")}
          onClick={() => runTableAction("insertRowBelow")}
          title="下方插入行"
          aria-label="下方插入行"
        >
          <BetweenVerticalEnd size={16} aria-hidden />
        </button>
        <button
          type="button"
          className="ietm-icon-btn"
          disabled={tableActionDisabled("deleteRow")}
          onClick={() => runTableAction("deleteRow")}
          title="删除行"
          aria-label="删除行"
        >
          <Rows3 size={16} aria-hidden />
        </button>
      </div>

      <span className="ietm-format-toolbar__divider" />

      <div className="ietm-format-toolbar__cluster">
        <button
          type="button"
          className="ietm-icon-btn"
          disabled={tableActionDisabled("insertColLeft")}
          onClick={() => runTableAction("insertColLeft")}
          title="左侧插入列"
          aria-label="左侧插入列"
        >
          <BetweenHorizontalStart size={16} aria-hidden />
        </button>
        <button
          type="button"
          className="ietm-icon-btn"
          disabled={tableActionDisabled("insertColRight")}
          onClick={() => runTableAction("insertColRight")}
          title="右侧插入列"
          aria-label="右侧插入列"
        >
          <BetweenHorizontalEnd size={16} aria-hidden />
        </button>
        <button
          type="button"
          className="ietm-icon-btn"
          disabled={tableActionDisabled("deleteCol")}
          onClick={() => runTableAction("deleteCol")}
          title="删除列"
          aria-label="删除列"
        >
          <Columns3 size={16} aria-hidden />
        </button>
      </div>

      <span className="ietm-format-toolbar__divider" />

      <div className="ietm-format-toolbar__cluster">
        <button
          type="button"
          className="ietm-icon-btn"
          disabled={tableActionDisabled("mergeCells")}
          onClick={() => runTableAction("mergeCells")}
          title="合并单元格"
          aria-label="合并单元格"
        >
          <Combine size={16} aria-hidden />
        </button>
        <button
          type="button"
          className="ietm-icon-btn"
          disabled={tableActionDisabled("splitCell")}
          onClick={() => runTableAction("splitCell")}
          title="拆分单元格"
          aria-label="拆分单元格"
        >
          <Split size={16} aria-hidden />
        </button>
        <button
          type="button"
          className="ietm-icon-btn"
          disabled={tableActionDisabled("deleteCell")}
          onClick={() => runTableAction("deleteCell")}
          title="删除单元格"
          aria-label="删除单元格"
        >
          <TableCellsSplit size={16} aria-hidden />
        </button>
        <button
          type="button"
          className="ietm-icon-btn"
          disabled={tableActionDisabled("clearCell")}
          onClick={() => runTableAction("clearCell")}
          title="清空单元格"
          aria-label="清空单元格"
        >
          <Eraser size={16} aria-hidden />
        </button>
      </div>
    </>
  );
}
