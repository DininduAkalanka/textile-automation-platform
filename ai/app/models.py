from typing import Literal

from pydantic import BaseModel, Field


class ProductDoc(BaseModel):
    """A product as the retriever returns it, and as the LLM is shown it."""

    id: str
    name: str
    description: str | None = None
    price: float
    stock: int
    product_type: str
    fabric_type: str | None = None
    color: str | None = None
    unit: str | None = None
    requires_measurement: bool = False
    image: str | None = None


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    message: str = Field(min_length=1)
    history: list[ChatTurn] = Field(default_factory=list)


class ProductCard(BaseModel):
    """
    What the chat widget renders.

    Hydrated from the DATABASE, never from the model's output. The LLM chooses
    which ids to show; every field a customer sees — the price they will pay, the
    stock we claim to have — is read back from Postgres. A model that
    hallucinates a price cannot make us honour it.
    """

    id: str
    name: str
    price: float
    stock: int
    image: str | None = None
    link: str
    requires_measurement: bool = False


class ChatResponse(BaseModel):
    message: str
    products: list[ProductCard] = Field(default_factory=list)
    # False when the answer degraded to a plain ranked list (no API key, or the
    # model failed). The UI can be honest about it rather than pretending.
    llm: bool = True
