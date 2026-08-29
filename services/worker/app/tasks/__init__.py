# Force task registration on import
from app.tasks import parser  # noqa: F401
from app.tasks import poster  # noqa: F401
from app.tasks import warmup  # noqa: F401
from app.tasks import listener  # noqa: F401
from app.tasks import billing  # noqa: F401
from app.tasks import comment_scraper  # noqa: F401
from app.tasks import vk_listener  # noqa: F401
from app.tasks import vk_poster  # noqa: F401
from app.tasks import vk_comment_scraper  # noqa: F401
