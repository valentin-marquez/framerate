# Tracker

> **Nota:** Este proyecto está diseñado para actuar como un **tracker de precios**, manteniendo los datos actualizados con mayor frecuencia. A diferencia del scraper principal ubicado en `apps/scraper`, este componente se encarga de monitorear cambios en los precios y la disponibilidad de productos con mayor frecuencia, aunque no en tiempo real. Esto permite actualizaciones más rápidas cuando un producto se agota o cambia de precio, sin depender de la ejecución periódica de los crawlers.

> **Importante:** Este tracker no busca nuevos productos en las páginas web de las tiendas. En su lugar, trabaja exclusivamente con los productos que ya están registrados en la base de datos, asegurando que los datos existentes se mantengan actualizados de manera eficiente.