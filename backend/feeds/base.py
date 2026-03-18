from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

@dataclass
class RawSignal:
    source_id: str
    title: str
    description: str
    published_at: datetime
    cve_id: Optional[str] = None
    affected_vendors: list = field(default_factory=list)
    severity_hint: Optional[str] = None
    url: Optional[str] = None
    raw: dict = field(default_factory=dict)

class FeedConnector(ABC):
    name: str = ""
    display_name: str = ""
    requires_api_key: bool = False

    @abstractmethod
    async def fetch(self) -> list[RawSignal]:
        ...

    def is_available(self, env: dict) -> bool:
        return True
