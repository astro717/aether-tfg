import { useLayoutEffect, useRef } from 'react';
import type { Message } from '../api/messagingApi';

export function useChatScroll(
  containerRef: React.RefObject<HTMLDivElement | null>,
  messages: Message[],
  currentUserId: string
) {
  const prevScrollHeight = useRef<number>(0);
  const prevScrollTop = useRef<number>(0);
  const prevMessagesLength = useRef<number>(0);
  const prevLastMessageId = useRef<string | null>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scrollHeight = container.scrollHeight;
    const scrollTop = container.scrollTop;
    const clientHeight = container.clientHeight;

    // Detectar si la inserción de nuevos elementos ha alterado la longitud del array
    if (messages.length > prevMessagesLength.current) {
      const isNearBottom = prevScrollHeight.current - prevScrollTop.current - clientHeight < 150;

      const lastMessage = messages[messages.length - 1];
      const isOurMessage = lastMessage?.sender_id === currentUserId;
      const isNewMessageAtBottom = lastMessage?.id !== prevLastMessageId.current;

      if (isNewMessageAtBottom && (isNearBottom || isOurMessage)) {
        // 1. Mensaje nuevo al final y estábamos cerca del fondo (o lo enviamos nosotros)
        // -> Forzamos el salto limpio hasta abajo
        container.scrollTop = scrollHeight;
      } else {
        // 2. Posible carga de historial (Pull to Refresh hacia arriba) o
        // interjección mientras leíamos el pasado.
        // Si el contenedor ha crecido en altura, el navegador desplaza "físicamente" nuestro Viewport.
        // Solución: Sumamos artificialmente ese diferencial negativo al scrollTop para anular el Thrashing.
        const heightDelta = scrollHeight - prevScrollHeight.current;
        if (heightDelta > 0 && prevScrollTop.current < 100) {
          container.scrollTop = scrollTop + heightDelta;
        }
      }
    }

    // Guardar snapshots para el siguiente ciclo de render
    prevScrollHeight.current = scrollHeight;
    prevScrollTop.current = container.scrollTop;
    prevMessagesLength.current = messages.length;

    if (messages.length > 0) {
      prevLastMessageId.current = messages[messages.length - 1].id;
    }
  }, [messages, currentUserId, containerRef]);

  // Exponer API acoplada para forzar el scroll manual al inicio de sesión o al cambiar de usuario
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    if (containerRef.current) {
      setTimeout(() => {
        containerRef.current?.scrollTo({
          top: containerRef.current.scrollHeight,
          behavior
        });
      }, 10);
    }
  };

  return { scrollToBottom };
}
