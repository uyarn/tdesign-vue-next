import { computed, defineComponent, nextTick, onUpdated, ref, watch } from 'vue';
import { CloseIcon } from 'tdesign-icons-vue-next';
import { useReceiver } from '../config-provider/useReceiver';
import { useEmitEvent } from '../hooks/event';
import { addClass, removeClass } from '../utils/dom';
import { ClassName, Styles } from '../common';
import { prefix } from '../config';
import { Button as TButton } from '../button';
import props from './props';
import { FooterButton, DrawerCloseContext } from './type';
import { renderTNodeJSX, renderContent } from '../utils/render-tnode';
import TransferDom from '../utils/transfer-dom';
import { DrawerConfig } from '../config-provider/config-receiver';
import useAction from './action';

type FooterButtonType = 'confirm' | 'cancel';

const name = `${prefix}-drawer`;
const lockClass = `${prefix}-drawer--lock`;

export default defineComponent({
  name: 'TDrawer',

  components: {
    CloseIcon,
    TButton,
  },

  directives: {
    TransferDom,
  },

  props,

  emits: [
    'open',
    'close',
    'opened',
    'closed',
    'update:visible',
    'overlay',
    'close-btn',
    'esc-keydown',
    'confirm',
    'cancel',
  ],

  setup(props, { emit }) {
    const { global } = useReceiver<DrawerConfig>('drawer');
    const { getConfirmBtn, getCancelBtn } = useAction();
    const emitEvent = useEmitEvent(props, emit);
    const ele = ref<HTMLElement | null>(null);
    const drawerClasses = computed<ClassName>(() => {
      return [
        't-drawer',
        `t-drawer--${props.placement}`,
        {
          't-drawer--open': props.visible,
          't-drawer--attach': props.showInAttachedElement,
          't-drawer--without-mask': !props.showOverlay,
        },
      ];
    });

    const sizeValue = computed<string>(() => {
      const defaultSize = isNaN(Number(props.size)) ? props.size : `${props.size}px`;
      return (
        {
          small: '300px',
          medium: '500px',
          large: '760px',
        }[props.size] || defaultSize
      );
    });
    const wrapperStyles = computed<Styles>(() => {
      return {
        // 用于抵消动画效果：transform: translateX(100%); 等
        transform: props.visible ? 'translateX(0)' : undefined,
        width: ['left', 'right'].includes(props.placement) ? sizeValue.value : '',
        height: ['top', 'bottom'].includes(props.placement) ? sizeValue.value : '',
      };
    });

    const wrapperClasses = computed<ClassName>(() => {
      return ['t-drawer__content-wrapper', `t-drawer__content-wrapper--${props.placement}`];
    });

    const parentNode = computed<HTMLElement>(() => {
      return ele.value && (ele.value.parentNode as HTMLElement);
    });

    const modeAndPlacement = computed<string>(() => {
      return [props.mode, props.placement].join();
    });

    const footerStyle = computed<Styles>(() => {
      return {
        display: 'flex',
        justifyContent: props.placement === 'right' ? 'flex-start' : 'flex-end',
      };
    });
    const handlePushMode = () => {
      if (props.mode !== 'push') return;
      nextTick(() => {
        if (!parentNode.value) return;
        parentNode.value.style.cssText = 'transition: margin 300ms cubic-bezier(0.7, 0.3, 0.1, 1) 0s;';
      });
    };
    // push 动画效果处理
    const updatePushMode = () => {
      if (!parentNode.value) return;
      if (props.mode !== 'push' || !parentNode.value) return;
      const marginStr = {
        left: `margin: 0 0 0 ${sizeValue.value}`,
        right: `margin: 0 0 0 -${sizeValue.value}`,
        top: `margin: ${sizeValue.value} 0 0 0`,
        bottom: `margin: -${sizeValue.value} 0 0 0`,
      }[props.placement];
      if (props.visible) {
        parentNode.value.style.cssText += marginStr;
      } else {
        parentNode.value.style.cssText = parentNode.value.style.cssText.replace(/margin:.+;/, '');
      }
    };
    const getDefaultBtn = (btnType: FooterButtonType, btnApi: FooterButton) => {
      const isCancel = btnType === 'cancel';
      const clickAction = isCancel ? cancelBtnAction : confirmBtnAction;
      const theme = isCancel ? 'default' : 'primary';
      const isApiObject = typeof btnApi === 'object';
      return (
        <t-button theme={theme} onClick={clickAction} props={isApiObject ? btnApi : {}} class={`${name}-${btnType}`}>
          {btnApi && typeof btnApi === 'object' ? btnApi.content : btnApi}
        </t-button>
      );
    };
    const isUseDefault = (btnApi: FooterButton) => {
      const baseTypes = ['string', 'object'];
      return Boolean(btnApi && baseTypes.includes(typeof btnApi));
    };
    // locale 全局配置，插槽，props，默认值，决定了按钮最终呈现
    const getDefaultFooter = () => {
      // this.getConfirmBtn is a function of ActionMixin
      const confirmBtn = getConfirmBtn({
        confirmBtn: props.confirmBtn,
        globalConfirm: global.value.confirm,
        className: `${prefix}-drawer__confirm`,
      });
      // this.getCancelBtn is a function of ActionMixin
      const cancelBtn = getCancelBtn({
        cancelBtn: props.cancelBtn,
        globalCancel: global.value.cancel,
        className: `${prefix}-drawer__cancel`,
      });
      return (
        <div style={footerStyle.value}>
          {props.placement === 'right' ? confirmBtn : null}
          {cancelBtn}
          {props.placement !== 'right' ? confirmBtn : null}
        </div>
      );
    };
    watch(
      modeAndPlacement,
      () => {
        handlePushMode();
      },
      { immediate: true },
    );
    watch(
      () => props.visible,
      (value: boolean) => {
        if (value && !props.showInAttachedElement) {
          props.preventScrollThrough && addClass(document.body, lockClass);
        } else {
          props.preventScrollThrough && removeClass(document.body, lockClass);
        }
      },
      { immediate: true },
    );
    const handleCloseBtnClick = (e: MouseEvent) => {
      emitEvent('close-btn', e);
      closeDrawer({ trigger: 'close-btn', e });
    };
    const handleWrapperClick = (e: MouseEvent) => {
      emitEvent('overlay', e);
      if (props.closeOnOverlayClick) {
        closeDrawer({ trigger: 'overlay', e });
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      // 根据closeOnEscKeydown判断按下ESC时是否触发close事件
      if (props.closeOnEscKeydown && e.key === 'Escape') {
        emitEvent('esc-keydown', e);
        closeDrawer({ trigger: 'esc', e });
      }
    };
    const confirmBtnAction = (e: MouseEvent) => {
      emitEvent('confirm', e);
    };
    const cancelBtnAction = (e: MouseEvent) => {
      emitEvent('cancel', e);
      closeDrawer({ trigger: 'cancel', e });
    };
    const closeDrawer = (params: DrawerCloseContext) => {
      emitEvent('close', params);
      emitEvent('update:visible', false);
    };

    onUpdated(() => {
      updatePushMode();
    });

    return {
      ele,
      drawerClasses,
      wrapperStyles,
      modeAndPlacement,
      wrapperClasses,
      handlePushMode,
      updatePushMode,
      getDefaultBtn,
      isUseDefault,
      getDefaultFooter,
      handleCloseBtnClick,
      handleWrapperClick,
      onKeyDown,
      confirmBtnAction,
      cancelBtnAction,
      closeDrawer,
    };
  },

  render() {
    if (this.destroyOnClose && !this.visible) return;
    const defaultCloseBtn = <close-icon class="t-submenu-icon"></close-icon>;
    const body = renderContent(this, 'default', 'body');
    const defaultFooter = this.getDefaultFooter();
    return (
      <div
        class={this.drawerClasses}
        style={{ zIndex: this.zIndex }}
        onKeydown={this.onKeyDown}
        v-transfer-dom={this.attach}
        {...this.$attrs}
        ref="ele"
      >
        {this.showOverlay && <div class={`${name}__mask`} onClick={this.handleWrapperClick} />}
        <div class={this.wrapperClasses} style={this.wrapperStyles}>
          {this.header && <div class={`${name}__header`}>{renderTNodeJSX(this, 'header')}</div>}
          {this.closeBtn && (
            <div class={`${name}__close-btn`} onClick={this.handleCloseBtnClick}>
              {renderTNodeJSX(this, 'closeBtn', defaultCloseBtn)}
            </div>
          )}
          <div class={[`${name}__body`, 'narrow-scrollbar']}>{body}</div>
          {this.footer && <div class={`${name}__footer`}>{renderTNodeJSX(this, 'footer', defaultFooter)}</div>}
        </div>
      </div>
    );
  },
});
