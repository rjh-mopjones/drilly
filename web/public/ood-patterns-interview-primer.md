---
type: interview-prep
---

# OOD & Design Patterns Interview Primer — 332 Questions

Comprehensive Q+A primer for object-oriented design and low-level-design (LLD) interviews. A System Fundamentals companion focused on the **class/object model of a single application** — distinct from the System Design Patterns primer, which covers distributed-systems architecture. Covers the OO pillars, class relationships & UML, SOLID, core design principles, coupling/cohesion & dependency injection, all 23 Gang-of-Four patterns (creational, structural, behavioral), pattern selection & anti-patterns, code smells & refactoring, domain modeling, composition/inheritance/polymorphism in practice, designing for change, thread-safety in OOD, the LLD interview process, and fully-worked LLD case studies.

Each answer is interview-shaped: opinionated, concrete, with real Java/Python/C++/TypeScript code, ASCII UML class diagrams, before/after refactors, and comparison tables (composition vs inheritance, abstract class vs interface, Factory Method vs Abstract Factory, Strategy vs State, Adapter vs Decorator vs Proxy). Warm-up ("what is polymorphism", "abstract class vs interface", "what problem does Observer solve") to senior ("design a parking lot", "when does inheritance violate LSP", "refactor this god class", "which pattern — Strategy or State").

1. [[#Object-Oriented Fundamentals]]
2. [[#Class Relationships & UML]]
3. [[#SOLID Principles]]
4. [[#Core Design Principles]]
5. [[#Coupling, Cohesion & Dependencies]]
6. [[#Creational Patterns I: Factory & Builder]]
7. [[#Creational Patterns II: Singleton, Prototype & Object Pool]]
8. [[#Structural Patterns I: Adapter, Decorator & Facade]]
9. [[#Structural Patterns II: Composite, Proxy, Bridge & Flyweight]]
10. [[#Behavioral Patterns I: Strategy, Observer & Command]]
11. [[#Behavioral Patterns II: State, Template Method & Chain of Responsibility]]
12. [[#Behavioral Patterns III: Iterator, Mediator, Visitor & Memento]]
13. [[#Pattern Selection & Anti-Patterns]]
14. [[#Code Smells & Refactoring]]
15. [[#Domain Modeling & Abstraction]]
16. [[#Composition, Inheritance & Polymorphism in Practice]]
17. [[#Designing for Change & Extensibility]]
18. [[#Concurrency & Thread-Safety in OOD]]
19. [[#The LLD Interview Process]]
20. [[#LLD Case Studies I]]
21. [[#LLD Case Studies II & Playbooks]]

## Object-Oriented Fundamentals

### Summary

**What this topic covers**

The bedrock of object-oriented design: the four pillars (encapsulation, abstraction, inheritance, polymorphism) with real code rather than dictionary definitions; the difference between a **class** (a template) and an **object** (an instance); the interview-perennial **interface vs abstract class** and when each earns its place; the three flavours of **polymorphism** (subtype/dynamic dispatch, ad-hoc/overloading, parametric/generics); **identity vs equality**; **static vs dynamic dispatch**; and **message passing** as the original mental model behind OO. It closes with why OO exists at all and the honest critiques of it. The 16 questions here are the vocabulary every later topic (Class Relationships, SOLID, the GoF patterns, LLD case studies) assumes you already speak fluently.

**Mental model**

Stop thinking of an object as "a bag of data." Think of it as **a small machine that hides its wiring and exposes buttons**. The data (state) is private; the buttons (methods) are the public contract. You send a message ("do this") and the object decides how — that decision, resolved at runtime against the object's *actual* type, is polymorphism. Encapsulation draws the boundary of the machine; abstraction decides which buttons are worth exposing; inheritance and composition are two ways to build a bigger machine from smaller ones. The single most important senior instinct is: **model behaviour and responsibility, not data structure.** A `BankAccount` is not "a number called balance" — it is a thing that can `deposit`, `withdraw`, and *refuse* an overdraft. When you design classes around what they *do* and what they *protect*, the SOLID principles and half the GoF patterns fall out naturally. When you design around data fields with getters and setters bolted on, you get an anemic model and every pattern feels like bureaucracy.

**Key terms**

- **Class** — a blueprint: fields + methods + a construction contract. Compile-time concept.
- **Object / instance** — a concrete thing created from a class, living on the heap with its own state. Runtime concept.
- **Encapsulation** — hiding internal state and exposing behaviour; the outside touches data only through methods.
- **Abstraction** — exposing a simple, intent-revealing interface while suppressing implementation detail.
- **Inheritance** — an "is-a" relationship where a subclass reuses and specialises a superclass.
- **Polymorphism** — one interface, many implementations; "poly" (many) "morph" (forms).
- **Dynamic dispatch** — the runtime picks the method body based on the object's real class, not its declared type.
- **Interface** — a pure capability contract: method signatures, no state (constants aside).
- **Abstract class** — a partially-implemented base: may hold state, constructors, and concrete methods.
- **Identity** — "same object?" (`==` / reference equality). **Equality** — "same value?" (`equals`).
- **Message passing** — Alan Kay's original framing: objects communicate by sending messages, not by reaching into each other's data.
- **Duck typing** — "if it walks like a duck," structural polymorphism where the method's existence, not a declared type, is what matters (Python, JS).

**Why interviewers ask this**

This is the warm-up that separates people who *use* OO from people who *understand* it. A junior recites "encapsulation, inheritance, polymorphism, abstraction" as four words. A senior explains *why* encapsulation matters (you can change the internals without breaking callers), *when* inheritance is the wrong tool (fragile base class, favour composition), and *what dynamic dispatch actually does at runtime*. The interface-vs-abstract-class question is a reliable signal: weak candidates list syntactic differences ("interfaces can't have fields"); strong candidates answer with a *design heuristic* ("interface for a capability that cuts across unrelated types; abstract class for an is-a hierarchy that shares state or template steps"). Getting identity-vs-equality right previews whether you can be trusted with `hashCode`, collections, and value objects. This topic is cheap to ask and enormously predictive.

**Common confusions**

- "Encapsulation means getters and setters" — no; a setter for every field is *broken* encapsulation. Encapsulation means exposing *behaviour*, not plumbing direct field access.
- "Abstraction and encapsulation are the same" — abstraction is about the *interface you show*; encapsulation is about the *state you hide*. Related, not identical.
- "Inheritance is code reuse" — inheritance is *subtyping*; use it for "is-a", not to grab a method. Composition is the reuse tool.
- "Overloading is polymorphism" — it's *ad-hoc* polymorphism, resolved at compile time. The interesting kind (subtype) is resolved at runtime.
- "== compares values" — in Java/C# `==` on references is *identity*; `equals` is value equality. In C++ `==` is whatever you overload it to be.
- "An abstract class with all-abstract methods is just an interface" — behaviourally close, but it burns your single-inheritance slot and can't be mixed in.

**What follows from this topic**

Everything. **Class Relationships & UML** takes "inheritance vs composition" and formalises association / aggregation / composition. **SOLID** is a set of rules for *how* to apply polymorphism and abstraction without creating fragile hierarchies — LSP is literally a rule about when subtype polymorphism is safe. The **GoF patterns** are all recombinations of "program to an interface," dynamic dispatch, and composition. If subtype polymorphism and interface-vs-abstract-class feel fuzzy, fix them here before moving on — patterns built on a shaky grasp of dispatch will feel like magic incantations rather than tools.

### Q1. What are the four pillars of OOP? Give a concrete example of each.

Four principles, each solving a distinct problem:

**Encapsulation** — bundle state with the behaviour that guards it; hide the state. The class enforces its own invariants.

```java
class BankAccount {
    private long balanceCents;            // hidden state
    public void withdraw(long cents) {    // guarded behaviour
        if (cents > balanceCents) throw new IllegalStateException("overdraft");
        balanceCents -= cents;
    }
    public long balanceCents() { return balanceCents; }  // read-only view
}
```
No public setter for `balanceCents` — you cannot corrupt the balance from outside.

**Abstraction** — expose *what*, hide *how*. `List.add(x)` is the same call whether it is an `ArrayList` (array copy) or `LinkedList` (node splice). Callers depend on the idea "ordered collection," not the mechanism.

**Inheritance** — model "is-a" and specialise. `SavingsAccount extends BankAccount` reuses `withdraw` and adds `applyInterest`.

**Polymorphism** — one call site, many behaviours:
```java
for (BankAccount a : accounts) a.applyMonthlyFee();  // each subtype does its own thing
```

The interview trap: don't just name them. Say *why* each matters — encapsulation protects invariants, abstraction decouples callers from implementations, inheritance/polymorphism let you add new types without touching existing code (that is Open/Closed).

### Q2. What is the difference between a class and an object?

A **class** is the blueprint; an **object** is a house built from it. The class defines *structure* (fields) and *behaviour* (methods) and exists at compile time. The object is a concrete instance created at runtime, occupying memory, holding its own copy of the state.

```java
class Dog { String name; void bark() { System.out.println(name + " woofs"); } }

Dog a = new Dog();  a.name = "alice-dog";   // one object
Dog b = new Dog();  b.name = "bob-dog";     // a different object, own state
```

One class, many objects, each with independent state but shared behaviour (the method code is stored once, per-class). A **static** member belongs to the class itself, not any instance — there is exactly one, shared across all objects. If you find yourself confused about "why did changing `a` not change `b`," you are confusing the blueprint with the buildings.

### Q3. Explain encapsulation. Isn't it just making fields private with getters and setters?

Encapsulation is **hiding state and exposing behaviour** so the object controls all changes to itself and can guarantee its invariants. Private fields are the *mechanism*; the *goal* is that no outside code can put the object into an illegal state.

A getter/setter for every field is **anti-encapsulation dressed up as encapsulation** — you've just added ceremony around public fields. Compare:

```java
// Broken: exposes plumbing, no invariant protected
class Rectangle { public int w, h; }               // or getters/setters for both

// Real encapsulation: behaviour, invariant enforced
class Temperature {
    private final double celsius;
    private Temperature(double c) {
        if (c < -273.15) throw new IllegalArgumentException("below absolute zero");
        this.celsius = c;
    }
    public static Temperature ofCelsius(double c) { return new Temperature(c); }
    public double fahrenheit() { return celsius * 9/5 + 32; }
}
```

The senior framing is **Tell, Don't Ask**: instead of asking an object for its data and acting on it, tell the object to act. `account.withdraw(100)` — not `if (account.getBalance() >= 100) account.setBalance(account.getBalance() - 100)`. The second version leaks the invariant into every caller.

### Q4. What is abstraction, and how does it differ from encapsulation?

**Abstraction** is deciding *which details are essential* and exposing only those — a simplified, intent-revealing model of a thing. **Encapsulation** is the mechanism of *hiding* the non-essential details behind that model. Abstraction is the *what you show*; encapsulation is *how you hide the rest*.

Example: a `PaymentGateway` interface exposes `charge(amount, card)`. That is abstraction — the essential idea of "take money." Behind it, encapsulation hides the retry logic, the HTTP client, the idempotency keys. You can swap Stripe for Adyen without any caller noticing, because the abstraction named the *intent* and the encapsulation hid the *implementation*.

| | Abstraction | Encapsulation |
|---|---|---|
| Concern | Design: what to expose | Implementation: what to hide |
| Question | "What is the essential interface?" | "How do I protect internal state?" |
| Tool | Interfaces, abstract classes | Access modifiers, private fields |
| Failure mode | Leaky abstraction | Broken invariants |

They work together: a good abstraction gives you a small interface; good encapsulation makes that interface the *only* way in.

### Q5. What is the difference between an interface and an abstract class? When do you use each?

An **interface** is a pure capability contract — method signatures, no instance state. An **abstract class** is a partially-built base — it can hold state, constructors, and concrete methods, and models an "is-a" hierarchy.

| | Interface | Abstract class |
|---|---|---|
| State (instance fields) | No (constants only) | Yes |
| Constructors | No | Yes |
| Method bodies | Default/static methods only | Full concrete methods |
| Multiple inheritance | Yes (implement many) | No (extend one) |
| Models | "can-do" capability | "is-a" specialisation with shared guts |

**Use an interface** when a capability cuts across unrelated types — `Comparable`, `Serializable`, `Flyable` might be implemented by `Bird`, `Plane`, and `Drone`, which share no ancestor. Interfaces are also what you *program to* for dependency inversion.

**Use an abstract class** when you have a genuine is-a family that shares **state** or a **template-method skeleton**:
```java
abstract class Report {
    public final String render() {          // template: fixed skeleton
        return header() + body() + footer();
    }
    protected String header() { return "== Report =="; }  // shared default
    protected abstract String body();       // subclass fills the varying step
    protected String footer() { return "== End =="; }
}
```

Heuristic: **default to an interface**; reach for an abstract class only when you need shared mutable state or a template method. Since Java 8 default methods and C#'s default interface methods, the gap narrowed — but only abstract classes hold instance state and eat your single-inheritance slot, so the "capability vs identity" distinction still decides.

### Q6. What are the different types of polymorphism?

Three kinds, and interviewers want you to name and distinguish them:

**Subtype (inclusion) polymorphism** — the OO default. A variable of a base type holds any subtype, and the *runtime* picks the method via dynamic dispatch. This is the powerful one.
```java
Shape s = new Circle();
s.area();   // Circle.area() runs, chosen at runtime
```

**Ad-hoc polymorphism (overloading)** — same method name, different parameter lists, resolved at **compile time** by the declared argument types.
```java
int max(int a, int b);
double max(double a, double b);   // different function, chosen by static type
```

**Parametric polymorphism (generics/templates)** — one implementation works over many types, parameterised by a type variable.
```java
<T> T firstOf(List<T> xs) { return xs.get(0); }   // works for any T
```

Bonus fourth in dynamic languages: **duck typing** — structural polymorphism where any object with the right method works, no declared type required (Python, Ruby, JS).

The distinction that matters: **subtype polymorphism is dynamic (runtime), overloading is static (compile time).** Confusing the two is a classic junior tell.

### Q7. What is dynamic dispatch, and how does static dispatch differ?

**Dispatch** is the process of deciding *which* method body runs for a call. **Static dispatch** resolves at compile time using the *declared* type; **dynamic dispatch** resolves at runtime using the object's *actual* type.

- **Overriding** → dynamic dispatch. The JVM/CLR consults the object's virtual method table (vtable) at runtime.
- **Overloading** → static dispatch. The compiler picks the overload from the argument's *declared* type.

```java
class Animal { String speak() { return "..."; } }
class Cat extends Animal { String speak() { return "meow"; } }

Animal a = new Cat();
a.speak();          // "meow"  — dynamic dispatch on actual type Cat
```

The classic gotcha combining both:
```java
void feed(Animal a) { System.out.println("animal"); }
void feed(Cat c)    { System.out.println("cat"); }

Animal a = new Cat();
feed(a);            // prints "animal" — overload chosen statically by declared type Animal
```
`speak()` dispatched dynamically (actual type wins); `feed()` dispatched statically (declared type wins). In C++, dynamic dispatch only happens for methods marked `virtual`; non-virtual methods are always static. In Java, all non-`final`, non-`static`, non-`private` methods are virtual by default.

### Q8. What is the difference between identity and equality?

**Identity** asks "are these the same object in memory?" **Equality** asks "do these objects represent the same value?" Two distinct objects can be equal without being identical.

```java
String a = new String("hi");
String b = new String("hi");
a == b        // false — identity: different objects
a.equals(b)   // true  — equality: same value
```

- Java: `==` is identity (reference) for objects; `equals()` is value equality (override it for value types).
- Python: `is` is identity; `==` is value equality (`__eq__`).
- C++: `==` is whatever you overload; `&x == &y` compares identity via addresses.

If you override `equals`, you **must** override `hashCode` so that equal objects share a hash code — otherwise they get lost in hash-based collections. This is why **value objects** (Money, Point, EmailAddress) override both and are ideally immutable: their identity is irrelevant, only their value matters. Getting this wrong silently breaks `HashSet`, `HashMap` keys, and `contains`.

### Q9. What is message passing in OO?

Message passing is the original mental model behind objects (Smalltalk, Alan Kay): objects don't reach into each other's data — they **send each other messages** ("please do X"), and the *receiver* decides how to respond. A method call `obj.doThing(arg)` *is* sending the message `doThing` to `obj`.

The point is **the sender doesn't know or care how the receiver handles it** — that decoupling is exactly what dynamic dispatch delivers. In dynamically-typed OO languages this goes further: Objective-C and Ruby can intercept messages for methods that don't literally exist (`method_missing`, `respondsToSelector:`), enabling proxies and dynamic APIs.

Why it matters in design: thinking in messages nudges you toward **Tell-Don't-Ask** and good encapsulation. You ask "what messages should this object respond to?" (its responsibilities) rather than "what fields does it have?" That reframing is the difference between a rich domain model and an anemic data bag.

### Q10. Why favour composition over inheritance?

Inheritance is a **static, compile-time, whitebox** relationship: the subclass is coupled to the superclass's internals and its every change. Composition is a **runtime, blackbox** relationship: your class *holds* another and delegates to its public interface. The design maxim "favour composition over inheritance" exists because inheritance is overused as a code-reuse shortcut and creates fragile hierarchies.

```java
// Inheritance abuse: a Stack is NOT really a Vector, but inherits all its methods
class Stack<E> extends Vector<E> { }   // now you can insertElementAt into a "stack" — broken

// Composition: expose only what a stack should expose
class Stack<E> {
    private final List<E> items = new ArrayList<>();
    public void push(E e) { items.add(e); }
    public E pop() { return items.remove(items.size() - 1); }
}
```

Composition wins because: (1) you expose only the operations you want; (2) you can swap the collaborator at runtime; (3) you avoid the fragile base class problem — a change to the base doesn't ripple into you; (4) you sidestep single-inheritance limits by holding several collaborators. Use **inheritance** only for genuine "is-a" where the subtype is substitutable everywhere the base is (see LSP). Use **composition** for "has-a" and for reuse.

### Q11. What is the fragile base class problem?

When a subclass depends on the *implementation details* of its superclass, a seemingly safe change to the base can silently break the subclass — even though the base's public contract is unchanged. That is the fragile base class problem, and it is the deepest argument against deep inheritance.

Classic example:
```java
class CountingSet<E> extends HashSet<E> {
    int added = 0;
    public boolean add(E e)              { added++; return super.add(e); }
    public boolean addAll(Collection<E> c){ added += c.size(); return super.addAll(c); }
}
```
`HashSet.addAll` internally calls `add` for each element. So adding 3 elements via `addAll` increments `added` by 3 (in `addAll`) *plus* 3 more (via the self-calls to the overridden `add`) — count is 6, not 3. The subclass assumed an internal behaviour of the base that isn't part of its contract. Worse, a future JDK could change `addAll` to *not* call `add`, silently changing your subclass's behaviour again.

The fix is composition (wrap, don't extend) so you only depend on the base's *published interface*, never its internal call patterns. This is exactly why the Decorator pattern wraps rather than subclasses.

### Q12. What is duck typing?

Duck typing is structural polymorphism: "if it walks like a duck and quacks like a duck, treat it as a duck." An object is acceptable if it has the *methods you call*, regardless of its declared type or inheritance. It is the norm in Python, Ruby, and JavaScript.

```python
def make_it_speak(thing):
    return thing.speak()          # works for ANY object with a speak() method

class Dog:  
    def speak(self): return "woof"
class Robot: 
    def speak(self): return "beep"

make_it_speak(Dog())    # "woof"
make_it_speak(Robot())  # "beep" — no shared base class needed
```

Contrast with Java/C++ **nominal** typing, where `thing` would need to be declared as some `Speaker` interface both types explicitly implement. Duck typing trades compile-time safety for flexibility — you find out at runtime if the method is missing (`AttributeError`). Python's protocols and TypeScript's structural typing are a middle ground: structural matching, but checked. The relevance to design: duck typing makes "program to an interface" implicit — you don't declare the interface, you just rely on the shape.

### Q13. Can you have multiple inheritance? What is the diamond problem?

**Multiple inheritance** is inheriting from more than one base class. C++ and Python allow it; Java and C# forbid it for *classes* (but allow implementing multiple *interfaces*). The reason for the restriction is the **diamond problem**.

```text
      Animal            (has a method describe())
      /     \
  Swimmer   Walker       (both override describe())
      \     /
    Amphibian            (which describe() does it inherit??)
```

If `Amphibian` inherits from both `Swimmer` and `Walker`, and both override `describe()`, which one wins? And if both derive from `Animal`, do you get one copy of `Animal`'s state or two?

Language answers:
- **Java/C#** — sidestep it: only one superclass, but many interfaces. Interfaces (pre-default-methods) had no state and no bodies, so no ambiguity. With default methods, if two interfaces provide the same default, the compiler *forces* you to override and disambiguate.
- **C++** — allows it; you resolve ambiguity explicitly (`Swimmer::describe()`), and use **virtual inheritance** to share one `Animal` base.
- **Python** — uses **MRO** (Method Resolution Order, C3 linearisation) to define a deterministic lookup order; `super()` follows it.

The design lesson: prefer composition or interfaces/mixins over multiple class inheritance; the diamond is a smell that you're using inheritance for reuse.

### Q14. Why use OOP at all? What are its main criticisms?

**Why OO:** it manages complexity by bundling state with the behaviour that guards it (encapsulation), lets you extend systems without editing existing code (polymorphism + Open/Closed), and gives you a vocabulary — objects modelling domain nouns — that maps to how people talk about the problem. For large, long-lived business systems with rich domain rules, a well-factored object model localises change: a new payment method is a new class, not a new branch scattered through the codebase.

**The criticisms are real and worth voicing:**
- **Inheritance is overused** and creates rigid, fragile hierarchies — hence "favour composition."
- **Encapsulation fights data-oriented performance** — objects scatter data across the heap (pointer chasing), hurting cache locality; games and high-perf systems prefer data-oriented / struct-of-arrays designs.
- **Anemic domain models** — much "OO" code is just data bags with a separate service layer full of procedural logic; that's not really OO, and arguably functional/procedural styles are more honest for it.
- **"Everything is an object" is dogma** — a lot of logic is just functions over data; forcing it into classes (`FileUtils`, `StringManager`) adds ceremony.
- **Shared mutable state** — objects encourage mutable state, which is the root of concurrency bugs; the functional camp argues immutability + pure functions scale better.

The senior answer: OO is *one tool*. Use it where behaviour and invariants cluster around data (domain modelling); reach for functional/procedural/data-oriented styles where they fit better. Modern languages (Kotlin, Scala, Rust, TS) are deliberately multi-paradigm for exactly this reason.

### Q15. What is the difference between overriding and overloading?

Both reuse a method name, but they are unrelated mechanisms — and mixing them up is a reliable junior tell.

| | Overriding | Overloading |
|---|---|---|
| Definition | Subclass redefines an inherited method | Same name, different parameter list, same class |
| Signature | Identical (name + params) | Different params (count/type/order) |
| Resolved | Runtime (dynamic dispatch) | Compile time (static dispatch) |
| Relationship | Requires inheritance | No inheritance needed |
| Polymorphism kind | Subtype | Ad-hoc |

```java
class A            { void f(int x)   { } }
class B extends A  { void f(int x)   { } }   // OVERRIDE: same signature, subclass
class C            { void f(int x)   { }
                     void f(String s){ } }   // OVERLOAD: same name, different params
```

Overriding is the engine of subtype polymorphism — the whole point of `@Override`. Overloading is a convenience (constructors with different arg sets, `println(int)` vs `println(String)`). The return type alone cannot distinguish overloads. Java has `@Override` precisely to catch the bug where you *think* you're overriding but a typo in the signature makes it an accidental overload.

### Q16. What does "program to an interface, not an implementation" mean?

Depend on an **abstraction** (interface / abstract type), not a **concrete class**. Your code should name the capability it needs, and let the concrete provider be injected — so you can swap implementations without touching the consumer.

```java
// Bad: welded to a specific implementation
class OrderService {
    private final ArrayList<Order> orders = new ArrayList<>();   // concrete type leaks
}

// Good: depends on the abstraction
class OrderService {
    private final List<Order> orders;                 // interface
    OrderService(List<Order> orders) { this.orders = orders; }   // injected
}
```

Now `OrderService` works with any `List` — `ArrayList`, `LinkedList`, a test double, a synchronised wrapper. The declared type is the *contract*; the implementation is a runtime detail. This single principle underlies dependency injection, the Dependency Inversion principle, Strategy, most of the GoF patterns, and testability (you can inject a fake). The practical rule: **declare variables, parameters, and return types by their most general useful interface**; instantiate the concrete type only at the composition boundary (the "new" belongs at the edges — factories, DI containers, `main`).

## Class Relationships & UML

### Summary

**What this topic covers**

How objects connect, and how to draw it. The relationship taxonomy every design conversation uses: **association** (uses-a / knows-a), **aggregation** (has-a, shared lifetime, hollow diamond), **composition** (owns-a, exclusive lifetime, filled diamond), **dependency** (transient uses), **inheritance/generalization** (is-a), and **realization** (implements an interface). Then the notation: reading and drawing a **UML class diagram** in ASCII (boxes, arrows, diamonds), **multiplicity** (1, 0..1, `*`, 1..*), and a light touch on **sequence diagrams** for showing interactions over time. The 15 questions here turn "these classes are related somehow" into a precise vocabulary — the classic sharp edge being **aggregation vs composition**, which interviewers love because it forces you to reason about object *lifecycle* and *ownership*.

**Mental model**

Every relationship answers two questions: **"who knows about whom?"** (the arrow direction, coupling) and **"who owns whose lifetime?"** (the diamond, memory/deletion semantics). Picture the arrows as *dependencies pointing toward what you depend on* — if `Order` points to `Customer`, `Order` breaks when `Customer` changes, not vice versa. Picture the diamonds as *destructors*: composition (filled diamond) means "when I die, my parts die with me" — a `House` owns its `Room`s, delete the house and the rooms are gone. Aggregation (hollow diamond) means "I hold these but I didn't create them and they outlive me" — a `Team` holds `Player`s, disband the team and the players persist. The whole art of reading a class diagram is turning these glyphs back into sentences: "an Order *has* one Customer, *owns* many LineItems, and *uses* a PaymentGateway." If you can narrate a diagram in plain English and redraw a described system in boxes, you have this topic.

**Key terms**

- **Association** — a structural "knows-a" link; one object holds a reference to another (a plain line/arrow). "A `Teacher` teaches `Student`s."
- **Aggregation** — a special association, "has-a" with **independent** lifetimes; hollow diamond `o--` on the owner side. Parts are shared/reusable.
- **Composition** — a stronger "owns-a" with **coincident** lifetimes; filled diamond `<>--`. Parts don't exist without the whole.
- **Dependency** — a transient "uses-a": one class uses another as a parameter, local, or return type, but doesn't hold it as a field. Dashed arrow `-->`.
- **Inheritance / generalization** — "is-a"; solid line, hollow triangle `<|--` pointing to the parent.
- **Realization** — "implements"; a class fulfilling an interface. Dashed line, hollow triangle `<|..`.
- **Multiplicity** — how many objects participate: `1`, `0..1`, `*` (zero or more), `1..*` (one or more).
- **Navigability** — which direction you can traverse the link (arrowhead); can be one- or bidirectional.
- **Role name** — the label on an association end describing the part's role ("employer", "reports-to").
- **Class diagram** — static structure: classes, attributes, methods, relationships.
- **Sequence diagram** — dynamic behaviour: objects (lifelines) exchanging messages over time.

**Why interviewers ask this**

Two signals. First, **can you communicate a design without code?** Whiteboard interviews are diagram-driven; if you can sketch a clean class diagram, discuss it with an interviewer, and evolve it, you demonstrate the actual job skill. Second, and more surgically, **aggregation vs composition** reveals whether you think about **object lifecycle and ownership** — a senior concern that touches memory management (in C++ it's literally who calls `delete`), cascade-delete semantics in ORMs, and aggregate boundaries in DDD. A junior says "aggregation and composition are both has-a." A senior says "composition means exclusive ownership and cascading deletion; aggregation means shared references and independent lifetimes — a `Car` composes its `Engine` but aggregates its `Driver`." Interviewers also probe whether you *over-specify* — real teams often just say "association" and move on, and knowing when the distinction matters (persistence, ownership) versus when it's pedantry is itself senior signal.

**Common confusions**

- "Aggregation and composition are basically the same" — they differ on **lifetime ownership**: composition = parts die with the whole; aggregation = parts outlive it.
- "The diamond goes on the part" — no, the diamond sits on the **whole/owner** side.
- "Dependency and association are the same" — association is a *held field* (persistent link); dependency is a *transient use* (parameter/local, no field).
- "Inheritance and realization use the same arrow" — both use a hollow triangle, but inheritance is a *solid* line (extends a class) and realization is a *dashed* line (implements an interface).
- "The arrow points from the parent to the child" — generalization arrows point *toward the parent* (the more general type).
- "Multiplicity is optional decoration" — it encodes real constraints (a `LineItem` belongs to exactly one `Order`); getting it wrong changes the model.

**What follows from this topic**

Relationships are the raw material of the **GoF patterns** — Composite is literally a recursive composition/aggregation of a tree; Decorator is an object holding (aggregating) another of the same interface; Strategy is an association to a swappable interface. **SOLID** speaks in these terms too: Dependency Inversion is about *which way the dependency arrows point*. And every **LLD case study** (parking lot, elevator) starts by identifying the nouns (classes) and drawing their relationships before any code. Master reading/drawing diagrams here and the case-study topics become "narrate the diagram, then fill in the methods."

### Q1. What are the main types of relationships between classes?

Six, ordered roughly from loosest to tightest coupling:

1. **Dependency** (`-->`, dashed) — "uses temporarily." `OrderPrinter` takes an `Order` as a method parameter. No stored reference.
2. **Association** (`--`, solid line) — "knows-a." A stored reference/field. `Order` has a `Customer` field.
3. **Aggregation** (`o--`, hollow diamond) — "has-a, shared lifetime." `Team` holds `Player`s that exist independently.
4. **Composition** (`<>--`, filled diamond) — "owns-a, exclusive lifetime." `House` owns `Room`s that die with it.
5. **Inheritance/generalization** (`<|--`, solid + hollow triangle) — "is-a." `SavingsAccount` is a `BankAccount`.
6. **Realization** (`<|..`, dashed + hollow triangle) — "implements." `ArrayList` realises `List`.

```text
+----------+  -->   +---------+     dependency (uses)
| Printer  |------->| Order   |
+----------+        +---------+

+----------+  o--   +---------+     aggregation (has-a, independent)
| Team     |<>------| Player  |     (hollow diamond on Team)
+----------+        +---------+

+----------+  <>--  +---------+     composition (owns-a, exclusive)
| House    |<#>-----| Room    |     (filled diamond on House)
+----------+        +---------+
```

The two axes to keep straight: **strength of the reference** (dependency < association < aggregation < composition) and **is-a vs has-a** (inheritance/realization are is-a; the rest are has-a/uses-a). The interview favourite is telling aggregation from composition — that hinges entirely on lifetime ownership.

### Q2. What is the difference between aggregation and composition?

Both are "has-a," but they differ on **who owns the lifetime** of the part.

| | Aggregation | Composition |
|---|---|---|
| Relationship | has-a (shared) | owns-a (exclusive) |
| Part lifetime | Independent of whole | Tied to whole |
| On whole deletion | Parts survive | Parts destroyed (cascade) |
| Sharing | Part can belong to many wholes | Part belongs to exactly one whole |
| UML glyph | Hollow diamond `o--` | Filled diamond `<>--` |
| Example | Team ↔ Players | House ↔ Rooms |

```java
// Composition: House CREATES and OWNS its Rooms — they die with it
class House {
    private final List<Room> rooms = new ArrayList<>();
    House() { rooms.add(new Room("kitchen")); }   // house makes its own rooms
}

// Aggregation: Team is GIVEN players that exist independently
class Team {
    private final List<Player> players;
    Team(List<Player> players) { this.players = players; }  // injected, shared
}
```

Tell: if the part is **created inside** the whole's constructor and never handed out, it's composition. If it's **passed in** and could belong elsewhere, it's aggregation. In C++ the difference is concrete — composition often means a by-value member or `unique_ptr` (the whole `delete`s it); aggregation means a raw pointer or `shared_ptr` to something it doesn't own. In practice, don't agonise: pick composition when deleting the whole should delete the part, aggregation otherwise.

### Q3. What is the difference between association and dependency?

**Association** is a *structural* relationship — one object holds a **reference** to another as a field, so the link persists for the object's life. **Dependency** is a *transient* relationship — one class merely *uses* another as a method parameter, local variable, or return type, without storing it.

```java
class Order {
    private Customer customer;         // ASSOCIATION: held field, persistent link
    double total(TaxPolicy policy) {   // DEPENDENCY: used, not stored
        return policy.apply(subtotal());
    }
}
```

`Order` *is associated with* a `Customer` (stored) and *depends on* a `TaxPolicy` (used momentarily). In UML, association is a solid line; dependency is a dashed arrow, usually reserved for the loosest "this compiles because of that" links. Rule of thumb: **field → association; parameter/local/return → dependency.** Aggregation and composition are just *stronger, more specific* associations with lifetime semantics layered on.

### Q4. What is multiplicity in a class diagram?

Multiplicity annotates each end of an association with *how many* objects participate. It sits near the line end, describing the count of that class per one instance of the other.

Common values: `1` (exactly one), `0..1` (optional, zero or one), `*` or `0..*` (zero or more), `1..*` (one or more), `n..m` (a specific range like `2..4`).

```text
+---------+ 1        * +-----------+
| Customer|------------| Order     |
+---------+ owner  places+-----------+
```
Read left-to-right and right-to-left: "one Customer places zero-or-more Orders; each Order belongs to exactly one Customer." That `1` on the Customer side is a real constraint — it says an Order can't be orphaned or shared between customers.

Multiplicity drives implementation: `*` on one side becomes a collection (`List<Order>`); `0..1` becomes a nullable reference; `1` becomes a required, non-null field enforced in the constructor. Getting multiplicity right is how a diagram encodes business rules — "a `Seat` has `1` `Passenger` at most, a `Flight` has `1..*` `Seat`s."

### Q5. How do you read a UML class diagram?

Read a class box top-to-bottom, then trace the connectors. Each box has three compartments: **name**, **attributes**, **operations**. Visibility prefixes: `+` public, `-` private, `#` protected, `~` package.

```text
+---------------------------+
|         Account           |   <- class name
+---------------------------+
| - id: String              |   <- attributes (- = private)
| - balanceCents: long      |
+---------------------------+
| + deposit(cents: long)    |   <- operations (+ = public)
| + withdraw(cents: long)   |
| + balance(): long         |
+---------------------------+
```

Then read the connectors as sentences using direction, glyph, and multiplicity:
```text
+----------+ 1     * +---------+ 1   1 +----------+
| Customer |--------| Account |<>------| Statement|
+----------+        +---------+        +----------+
        (association)      (composition: filled diamond on Account)
```
"A Customer has one-or-more Accounts (association); each Account owns exactly one Statement (composition — kill the account, the statement goes too)."

Reading order: (1) identify each class and its responsibilities from its operations; (2) follow inheritance triangles `<|--` to see the type hierarchy; (3) follow realization `<|..` to see which interfaces are implemented; (4) read associations/aggregations/compositions with their multiplicities as English sentences. If you can narrate the whole diagram aloud, you've read it.

### Q6. How would you draw a class diagram for a simple domain — say an online order?

Start from the nouns (classes), assign responsibilities (methods), then wire relationships with the right glyph and multiplicity. For an order system: a `Customer` places `Order`s; an `Order` owns its `LineItem`s and uses a `PaymentStrategy`; each `LineItem` refers to a `Product`.

```text
+-----------+ 1      * +-------------+ 1     1..* +-----------+
| Customer  |----------| Order       |<#>---------| LineItem  |
+-----------+  places  +-------------+  owns      +-----------+
                       | - status    |            | - qty:int |
                       | + total()   |            +-----------+
                       | + pay()     |                  | *
                       +-------------+                  | refers-to
                              : uses (dependency)       v 1
                              v                    +-----------+
                       +----------------+          | Product   |
                       |<<interface>>   |          +-----------+
                       | PaymentStrategy|
                       +----------------+
                              ^ <|..  (realization)
              +---------------+---------------+
        +--------------+              +--------------+
        | CardPayment  |              | PaypalPayment|
        +--------------+              +--------------+
```

Design decisions to voice: `Order <#>-- LineItem` is **composition** (line items have no meaning outside their order; delete the order, delete the items). `LineItem --> Product` is **association** with `*..1` multiplicity (many line items can point at one shared product; products live independently). `PaymentStrategy` is an **interface** with two **realizations**, and `Order` holds it via association (or takes it as a parameter — dependency). Naming the glyph choice and multiplicity *out loud* — "composition here because lifetime is exclusive" — is what scores points.

### Q7. What is the difference between inheritance and realization in UML?

Both are "is-a-kind-of" drawn with a **hollow triangle** pointing at the parent, but the line style differs and so does the meaning:

- **Inheritance (generalization)** — solid line + hollow triangle `<|--`. A class extends another class, inheriting its state and behaviour. "is-a."
- **Realization** — dashed line + hollow triangle `<|..`. A class implements an interface, promising to fulfil its contract but inheriting no implementation. "can-do / fulfils-contract."

```text
+-----------+                 +-----------------+
| Account   |                 | <<interface>>   |
+-----------+                 | Comparable      |
      ^ <|--  (solid)         +-----------------+
      |                              ^ <|..  (dashed)
+-----------+                        |
| Savings   |                  +-----------+
+-----------+                  | Money     |
+-----------+                  +-----------+
```
"`Savings` **is a** `Account`" (generalization, solid). "`Money` **realizes** `Comparable`" (dashed). The mnemonic: **solid = extends (a class), dashed = implements (an interface)**. Mixing them up on a whiteboard signals you don't cleanly separate concrete inheritance from interface contracts — which is exactly the distinction SOLID's Dependency Inversion cares about.

### Q8. When should you use aggregation vs composition in a real design? Give a concrete decision.

Ask one question: **"If I destroy the whole, should the part be destroyed too?"** Yes → composition. No → aggregation.

Concrete cases:
- **`Order` and `LineItem`** → composition. A line item is meaningless without its order; you never share a line item between orders; deleting the order should cascade-delete the items. Filled diamond.
- **`Playlist` and `Song`** → aggregation. Removing a playlist must not delete the songs — they're shared across many playlists and live in a library. Hollow diamond.
- **`University` and `Department`** → composition (a department can't exist without its university). **`University` and `Student`** → aggregation (students exist before enrolling and after graduating).

This isn't academic — it maps directly to code and persistence. Composition in an ORM means `cascade = ALL, orphanRemoval = true`; aggregation means no cascade delete. In C++, composition is a `unique_ptr` or value member (the whole owns and frees it); aggregation is a `shared_ptr` or non-owning reference. The pragmatic caveat: if the lifetime distinction doesn't affect your code or persistence, just call it "association" and don't burn interview time debating diamonds. Reserve the precision for where ownership *actually* changes behaviour.

### Q9. What is a sequence diagram, and when do you use it instead of a class diagram?

A **class diagram** shows *static structure* — what classes exist and how they relate. A **sequence diagram** shows *dynamic behaviour* — how objects **collaborate over time** to fulfil one scenario, message by message. Use a sequence diagram when the *interaction order* is the interesting part (a checkout flow, an auth handshake), and a class diagram when the *structure* is (the domain model).

```text
 Customer      Order        PaymentGateway     Inventory
    |            |                |                |
    |  pay()     |                |                |
    |----------->|                |                |
    |            |  charge(amt)   |                |
    |            |--------------->|                |
    |            |    ok          |                |
    |            |<---------------|                |
    |            |         reserve(items)          |
    |            |-------------------------------->|
    |            |            reserved             |
    |            |<--------------------------------|
    | confirmed  |                |                |
    |<-----------|                |                |
```

You read it top-to-bottom as time flowing down. Each vertical line is an object's **lifeline**; horizontal arrows are **messages** (solid = call, dashed = return); activation bars show when an object is doing work. In interviews you rarely draw a full formal one, but sketching the message order for a tricky flow (who calls whom, in what order, and where the failure branches are) demonstrates you think about *interactions*, not just static boxes. Reach for it when explaining a protocol or a multi-object collaboration; reach for the class diagram when explaining the domain shape.

### Q10. What does the direction of an arrow tell you in a class diagram?

The arrowhead encodes **navigability / dependency direction** — who *knows about* whom. If `Order --> Customer`, then `Order` holds a reference to `Customer` and can call it; `Customer` need not know `Order` exists. That directionality is coupling: the source depends on the target, so **changes flow backward along the arrow** — modify `Customer`'s interface and `Order` may break, not vice versa.

- **One-way arrow** — unidirectional; only the source can traverse to the target.
- **No arrowhead (plain line)** — often means bidirectional or unspecified navigability.
- **Generalization/realization triangle** — points toward the *more general* type (parent/interface).

Why it matters for design: you *want* dependencies to point toward stable abstractions (Dependency Inversion). If your arrows point from high-level policy toward low-level detail, a change in a detail ripples up into policy — fragile. If they point toward interfaces, details can change freely. So when you draw arrows, you're also drawing your coupling and deciding your change-resilience. A design review often *is* an argument about which way the arrows should point.

### Q11. How do you represent an interface and its implementations in UML?

An interface is a class box stereotyped `<<interface>>` (or shown in italics); implementations connect to it with **realization** — a dashed line and hollow triangle `<|..` pointing at the interface.

```text
              +------------------------+
              |     <<interface>>      |
              |     Repository         |
              +------------------------+
              | + save(e: Entity)      |
              | + findById(id): Entity |
              +------------------------+
                    ^  <|..   ^  <|..
                    |         |
      +----------------+   +------------------+
      | SqlRepository  |   | InMemoryRepo     |
      +----------------+   +------------------+
```

Then a consumer **depends on the interface**, not the concrete class — draw the dependency/association arrow from the client to the `<<interface>>` box:
```text
+---------------+ -->  +------------------------+
| OrderService  |----->|  <<interface>> Repository|
+---------------+      +------------------------+
```
This picture *is* Dependency Inversion drawn out: `OrderService` (high-level policy) points at the abstraction; `SqlRepository` (low-level detail) also points at the abstraction (via realization). Nothing points at the concretions. That inverted arrow pattern — both policy and detail depending on the interface in the middle — is the visual signature of a well-decoupled design, and being able to draw it on demand is strong senior signal.

### Q12. What is the difference between a "has-a" and an "is-a" relationship, and why does it matter?

**"is-a"** is inheritance/realization — a subtype *is a kind of* its supertype and must be usable everywhere the supertype is (`Circle` is-a `Shape`). **"has-a"** is composition/aggregation/association — an object *contains or uses* another (`Car` has-an `Engine`). Choosing the wrong one is the single most common OO modelling error.

The test for **is-a**: can the child substitute for the parent in *every* context without breaking behaviour (Liskov)? If not, it's not really is-a. Classic mistake: `Stack extends ArrayList` — a stack *has* a list, it isn't one; inheriting exposes `get(index)` and `add(index, e)` that violate stack semantics.

```java
// Wrong: is-a misused for reuse
class Stack<E> extends ArrayList<E> { }        // a Stack is NOT an ArrayList

// Right: has-a
class Stack<E> { private final List<E> items = new ArrayList<>(); /* delegate */ }
```

Why it matters: is-a commits you to the parent's *entire* contract and the fragile base class problem; has-a keeps you loosely coupled and swappable. The heuristic "favour composition over inheritance" is exactly "prefer has-a unless it's genuinely is-a." When drawing a diagram, every triangle (`<|--`) you draw is a promise of substitutability — draw a diamond or line instead when you only mean containment.

### Q13. How do you model a many-to-many relationship?

A many-to-many association (each side relates to many of the other) usually can't be represented directly in code or a database — you introduce an **association class** (a.k.a. join/link entity) that carries the relationship and any data *about* it.

```text
+---------+ *        * +----------+
| Student |------------| Course   |     many-to-many
+---------+            +----------+
              \        /
               \      /
            +--------------+
            | Enrollment   |   <- association class
            +--------------+
            | - grade      |   <- data that belongs to the RELATIONSHIP
            | - enrolledAt |
            +--------------+
```

A `Student` takes many `Course`s and a `Course` has many `Student`s; the **`Enrollment`** captures each specific pairing plus attributes that belong to neither side alone (the grade isn't a property of the student or the course — it's a property of *this student in this course*). In code this becomes an `Enrollment` class referenced by both, or two one-to-many relationships through the join entity. In a relational DB it's a join table with foreign keys to both. The senior insight: whenever a relationship *has its own data or lifecycle*, promote it to a first-class object. Grades, memberships, subscriptions, and assignments are all association classes hiding in a naive many-to-many.

### Q14. What UML glyphs should you memorise for a whiteboard interview?

A compact cheat sheet — enough to draw any design fluently:

```text
+-------+
| Class |          class box (name / attributes / operations compartments)
+-------+

A <|-- B           B extends A          (inheritance, solid + hollow triangle)
A <|.. B           B implements A       (realization, dashed + hollow triangle)
A <>-- B           A owns B             (composition, filled diamond on A)
A o-- B            A has B (shared)     (aggregation, hollow diamond on A)
A --> B            A associated-with B  (association, solid arrow)
A ..> B            A depends-on B       (dependency, dashed arrow)

+ public   - private   # protected   ~ package     (visibility)
1   0..1   *   1..*   2..5                          (multiplicity)
<<interface>>  <<abstract>>                         (stereotypes)
```

The four you'll use constantly: the **inheritance triangle**, the **realization dashed triangle**, the **composition filled diamond**, and the plain **association arrow**. Memorise which end the diamond goes on (the **whole**) and which way the triangle points (the **parent/interface**). Don't obsess over perfect Mermaid/UML fidelity in an interview — clarity beats correctness of glyph. If you draw a diamond and say "composition, exclusive lifetime" out loud, the interviewer follows even if your ASCII is rough. The narration matters more than the notation.

### Q15. When is drawing a UML diagram worth it, and when is it over-engineering?

**Worth it:** when you need to *communicate* or *reason* about structure that's non-trivial — sketching a domain model with 5-8 classes and their relationships before coding, explaining an existing design to a new teammate, or working through an LLD interview where the diagram *is* the deliverable. A rough class diagram is the fastest way to surface "wait, should that be composition or aggregation?" *before* you've written the wrong ORM mapping.

**Over-engineering:** generating exhaustive, tool-perfect UML for every class as documentation that immediately rots, modelling getters/setters and trivial data holders, or drawing all 14 UML diagram types when a class diagram and maybe one sequence diagram carry all the signal. Big-upfront-design UML fell out of favour precisely because the diagrams drifted from the code and became lies.

The pragmatic stance: **UML is a thinking and communication tool, not a deliverable.** Use lightweight, throwaway diagrams (whiteboard, ASCII, a quick Mermaid block) to *think* and *align*, then let the code be the source of truth. In interviews, always sketch — it shows structured thinking. In production, diagram the *hard parts* (the core domain, a tricky interaction) and skip the obvious. A diagram that has to be maintained in lockstep with code is usually a diagram that should have been the code.

## SOLID Principles

### Summary

**What this topic covers**

The five object-oriented design principles that Robert C. Martin grouped under the acronym SOLID — each stated, each shown with a **violation and a fix**: **S**ingle Responsibility (a class should have one reason to change), **O**pen/Closed (open for extension, closed for modification), **L**iskov Substitution (subtypes must be substitutable for their base — the rectangle/square problem), **I**nterface Segregation (many small interfaces beat one fat one), and **D**ependency Inversion (depend on abstractions, not concretions). Beyond reciting them, this topic covers how they **interrelate** (they reinforce each other and all serve "manage change"), the trap of **over-applying** them into needless abstraction, and the senior framing that SOLID is **a means, not an end** — a set of heuristics for change-resilient code, not commandments. The 16 questions run from "what is the S in SOLID" to "refactor this god class" and "when does inheritance violate LSP."

**Mental model**

SOLID is five answers to one question: **"how do I make code that survives change?"** Requirements churn; the enemy is a change that forces edits to scatter across many classes, or that breaks callers you didn't touch. Each principle attacks one flavour of that pain. **SRP** keeps unrelated reasons-to-change in separate classes so one change touches one place. **OCP** lets you add behaviour by adding a class, not editing a switch statement. **LSP** guarantees polymorphism actually works — that a subtype won't surprise code written against the base. **ISP** stops a change to one capability from forcing recompiles/reimplementations of clients that don't use it. **DIP** points dependencies at stable abstractions so volatile details can change underneath. Read them together and they describe a single style: **small classes with single responsibilities, depending on interfaces, extended by adding new implementations rather than editing old ones.** The trap is treating them as a checklist to maximise — over-applied, they produce a fog of one-method interfaces and factories. The mature reading: apply them where change actually hurts.

**Key terms**

- **SRP — Single Responsibility** — a class should have exactly one reason to change; one actor/stakeholder owns its behaviour.
- **OCP — Open/Closed** — software entities should be open for extension but closed for modification; add features by adding code, not editing existing code.
- **LSP — Liskov Substitution** — objects of a subtype must be usable anywhere the supertype is expected, without breaking correctness.
- **ISP — Interface Segregation** — clients shouldn't be forced to depend on methods they don't use; prefer many focused interfaces.
- **DIP — Dependency Inversion** — high-level modules and low-level modules should both depend on abstractions; abstractions shouldn't depend on details.
- **Reason to change** — a distinct source of new requirements (a stakeholder/actor); the unit SRP splits on.
- **Substitutability** — a subtype honours the base's contract: preconditions no stronger, postconditions no weaker, invariants preserved.
- **Extension point** — a seam (interface/abstract method/strategy) where new behaviour plugs in without editing existing code.
- **Fat interface** — an interface with many unrelated methods, forcing implementers to stub what they don't need.
- **Dependency injection** — supplying a class's collaborators from outside (constructor/setter); the usual mechanism for DIP.

**Why interviewers ask this**

SOLID is the lingua franca of design interviews — everyone claims to know it, so the bar is *demonstration*, not recitation. A junior lists the five words. A mid-level gives a textbook example per letter. A senior does three more things: (1) shows a **realistic violation from code they've seen** and the refactor, (2) explains how the principles **interconnect** (fixing an SRP violation often naturally introduces DIP), and (3) knows the **limits** — when applying a principle would add abstraction that costs more than the change-resilience it buys. The LSP rectangle/square question is a favourite because it punctures the naive "inheritance = is-a in English" instinct: a square *is a* rectangle in geometry but *is not* a substitutable subtype in code. Interviewers use SOLID to see whether you can *reason about change*, spot smells, and refactor safely — the daily work of a senior engineer.

**Common confusions**

- "SRP means a class does one thing" — it means one *reason to change* (one actor); a class can do several closely-related things that all change together.
- "OCP means never edit existing code" — it means design *extension points* for the axes you expect to vary; you still edit code for genuinely new requirements.
- "LSP is just is-a" — it's about *behavioural* substitutability (contracts), not English "is-a." Square/Rectangle passes is-a and fails LSP.
- "ISP is about class size" — it's about *client-specific* interfaces; the metric is "does the client depend on methods it doesn't call?"
- "DIP means use dependency injection" — DI is a *mechanism*; DIP is the *principle* of pointing dependencies at abstractions. You can do DI and still violate DIP (injecting concretions).
- "More SOLID is always better" — over-applied, SOLID produces needless indirection; it's a means to manageable change, not a virtue in itself.

**What follows from this topic**

SOLID is the bridge from OO fundamentals to the GoF patterns. Nearly every pattern is a SOLID principle made concrete: **Strategy** and **Template Method** are OCP; **Dependency Injection**/factories serve DIP; the **Adapter** and role interfaces serve ISP; substitutability underlies every use of polymorphism, so **LSP** governs when *any* pattern's inheritance is safe. The refactoring/code-smells topic is SOLID in reverse — god objects violate SRP, shotgun surgery signals missing OCP seams, feature envy hints at misplaced responsibility. And LLD case studies are graded partly on whether your object model respects these principles. Learn SOLID as the *why* behind the patterns, and the patterns stop being a memorised catalogue and become obvious applications of principles you already hold.

### Q1. What does SOLID stand for, in one line each?

- **S — Single Responsibility Principle**: a class should have one reason to change (one actor it answers to).
- **O — Open/Closed Principle**: open for extension, closed for modification — add behaviour without editing existing code.
- **L — Liskov Substitution Principle**: subtypes must be usable anywhere their base type is, without breaking correctness.
- **I — Interface Segregation Principle**: don't force clients to depend on methods they don't use — prefer small, focused interfaces.
- **D — Dependency Inversion Principle**: depend on abstractions, not concretions; high-level policy shouldn't depend on low-level detail.

The through-line: all five are about **isolating change**. If you can only remember one framing, it's that SOLID is five tactics for making code cheap to change and safe to extend. The senior move in an interview is to state each in one line, then immediately offer to show a violation-and-fix for whichever the interviewer wants — that signals you *use* them, not just memorised the acronym.

### Q2. Explain the Single Responsibility Principle with a violation and a fix.

A class should have **one reason to change** — one actor whose needs drive its evolution. The common misread is "one method" or "one thing"; it's really "one *source of change*."

**Violation** — a class that formats, persists, and emails, three responsibilities owned by three different actors (report designers, DBAs, ops):
```java
class Report {
    String data;
    String formatHtml()      { /* presentation — changes when designers change */ }
    void   saveToDatabase()  { /* persistence — changes when schema changes */ }
    void   emailTo(String a) { /* delivery — changes when SMTP/provider changes */ }
}
```
A change to the email provider forces you into the same class the DBA edits for schema — merge conflicts, blast radius, fragile tests.

**Fix** — split by reason to change:
```java
class Report        { String data; }               // just the data/model
class ReportFormatter { String toHtml(Report r) { ... } }   // presentation
class ReportRepository{ void save(Report r) { ... } }       // persistence
class ReportMailer    { void send(Report r, String to) { ... } }  // delivery
```
Now each class has one owner and one reason to change; a formatting tweak can't break persistence. The tell for an SRP violation is a class name with "and" hiding in it, or a class you keep editing for unrelated reasons. Caveat: don't over-split — cohesive things that always change together belong together. SRP is about separating what changes *for different reasons*, not shattering every class into one method.

### Q3. Explain the Open/Closed Principle with a violation and a fix.

Entities should be **open for extension, closed for modification**: you should be able to add new behaviour by adding new code, not by editing existing, tested code. The smell it targets is the growing `switch`/`if-else` chain you must edit every time a new case appears.

**Violation** — every new shape means editing `AreaCalculator`:
```java
double area(Object shape) {
    if (shape instanceof Circle c)      return Math.PI * c.r * c.r;
    else if (shape instanceof Square s) return s.side * s.side;
    // add Triangle? EDIT this method again — risk breaking Circle/Square
}
```

**Fix** — invert with polymorphism; adding a shape adds a class, touches nothing existing:
```java
interface Shape { double area(); }
class Circle implements Shape { double r;    public double area() { return Math.PI*r*r; } }
class Square implements Shape { double side; public double area() { return side*side; } }
class Triangle implements Shape { /* NEW: just add this class */ public double area() {...} }

double total(List<Shape> shapes) { return shapes.stream().mapToDouble(Shape::area).sum(); }
```
`total()` never changes again. OCP is realised through **abstraction + polymorphism** (Strategy, Template Method, plugins). The nuance seniors add: **you can't be closed against everything** — you design extension points for the axes you *predict* will vary (new shapes, new payment methods) and accept that unforeseen changes still require edits. Speculatively abstracting every axis is over-engineering; the skill is predicting the *right* variation axis.

### Q4. Explain the Liskov Substitution Principle. Give the classic rectangle/square example.

LSP: **a subtype must be substitutable for its base type** without breaking any program written against the base. Formally — a subtype may weaken preconditions and strengthen postconditions, but never the reverse, and must preserve the base's invariants. Practically: code using a `Base` reference must not be surprised by a `Derived` instance.

The classic violation is **Square extends Rectangle**:
```java
class Rectangle {
    protected int w, h;
    void setWidth(int w)  { this.w = w; }
    void setHeight(int h) { this.h = h; }
    int area() { return w * h; }
}
class Square extends Rectangle {          // "a square IS-A rectangle" — in geometry, yes
    void setWidth(int w)  { this.w = w; this.h = w; }   // must keep sides equal
    void setHeight(int h) { this.w = h; this.h = h; }
}
```
Now a method written against `Rectangle` breaks:
```java
void resizeAndCheck(Rectangle r) {
    r.setWidth(5);
    r.setHeight(4);
    assert r.area() == 20;   // holds for Rectangle; FAILS for Square (area == 16)
}
```
`Square` violates LSP: it strengthens the invariant (w == h) in a way the base's contract didn't permit, so substituting it breaks correct client code. The lesson: **English "is-a" is not code "is-a."** A square is a rectangle mathematically but is *not* a behavioural subtype of a *mutable* `Rectangle`. Fixes: make them both immutable value objects (no setters, so no broken invariant), or don't relate them by inheritance at all — model `Shape` with an `area()` and drop the setWidth/setHeight contract. LSP is the rule that tells you when inheritance is *actually* safe.

### Q5. Explain the Interface Segregation Principle with a violation and a fix.

ISP: **clients shouldn't be forced to depend on methods they don't use.** Fat interfaces couple unrelated clients and force implementers to stub out irrelevant methods.

**Violation** — one `Worker` interface lumps eating and working; a robot can work but not eat:
```java
interface Worker { void work(); void eat(); }

class Robot implements Worker {
    public void work() { /* ... */ }
    public void eat()  { throw new UnsupportedOperationException(); }  // smell!
}
```
`Robot` is forced to implement `eat()` and lie about it — and any client that changes `eat()`'s signature drags `Robot` along.

**Fix** — split into role interfaces; each client depends only on what it uses:
```java
interface Workable { void work(); }
interface Eatable  { void eat(); }

class Human implements Workable, Eatable { public void work(){} public void eat(){} }
class Robot implements Workable          { public void work(){} }   // no fake eat()
```
Now a lunchroom scheduler depends on `Eatable`, a task runner on `Workable`, and `Robot` implements only what's true. ISP is really SRP applied to interfaces — segregate by client role. The tell for a violation is `UnsupportedOperationException`, no-op stubs, or an interface whose implementers each use a different subset of its methods. Java's `Collection` historically had this problem (optional operations like `add` throwing on immutable lists) — a cautionary tale. Split fat interfaces into cohesive, client-specific ones.

### Q6. Explain the Dependency Inversion Principle with a violation and a fix.

DIP: **high-level modules should not depend on low-level modules; both should depend on abstractions. And abstractions should not depend on details — details depend on abstractions.** The "inversion" is that the dependency arrow, which naively points from policy down to detail, is flipped to point at an interface both sides share.

**Violation** — high-level `OrderService` news-up a concrete `MySqlDatabase`, welding policy to a specific technology:
```java
class OrderService {
    private final MySqlDatabase db = new MySqlDatabase();   // concrete dependency
    void place(Order o) { db.insert(o); }
}
```
You can't test `OrderService` without MySQL, and swapping to Postgres means editing `OrderService`.

**Fix** — introduce an abstraction owned by the high-level side; inject the concrete detail:
```java
interface OrderRepository { void save(Order o); }             // abstraction

class OrderService {                                          // high-level policy
    private final OrderRepository repo;
    OrderService(OrderRepository repo) { this.repo = repo; }  // injected
    void place(Order o) { repo.save(o); }
}
class MySqlOrderRepository implements OrderRepository { ... } // low-level detail
```
Now both `OrderService` and `MySqlOrderRepository` depend on `OrderRepository`; the detail can change (Postgres, in-memory, a mock) without touching policy. Note the subtlety: the interface conceptually **belongs to the high-level module** (it's defined by what the policy needs), and the low-level module conforms to it — that's the inversion. **DI is the mechanism; DIP is the principle.** You can inject a concrete class (DI) and still violate DIP; the point is to depend on the *abstraction*.

### Q7. How do the five SOLID principles relate to each other?

They're not independent rules — they reinforce each other, all in service of **manageable change**, and applying one often pulls in another.

- **SRP → ISP**: SRP splits classes by reason to change; ISP is the same idea for interfaces (split by client role). ISP is "SRP for interfaces."
- **OCP needs DIP + LSP**: to be "closed for modification, open for extension," you extend through abstractions (DIP gives you the interface to plug into) and your new implementations must be substitutable (LSP guarantees they won't break existing callers). OCP is essentially "DIP + LSP applied to a variation axis."
- **DIP enables OCP**: depending on abstractions creates the seams where new behaviour plugs in without edits.
- **LSP protects polymorphism**: every principle that leans on polymorphism (OCP's extension, DIP's swapping) silently assumes subtypes are substitutable — LSP is the guarantee that makes the others safe.

A concrete illustration: refactoring an SRP-violating god class typically *extracts* collaborators (new classes), which you then depend on via *interfaces* (DIP), which creates *extension points* (OCP), and the implementations must be *substitutable* (LSP). Fix one well and the others tend to fall into place. The senior framing: SOLID is one coherent style — small, single-purpose units depending on abstractions, extended by addition — not five disconnected commandments.

### Q8. When does inheritance violate LSP? How do you detect it?

Inheritance violates LSP when a subtype **breaks a promise the base type made to its clients**. Detection signals, in order of usefulness:

1. **The subclass overrides a method to throw or no-op.** `Ostrich extends Bird { void fly() { throw new UnsupportedOperationException(); } }` — clients calling `bird.fly()` break. The base promised flight; the subtype reneges.
2. **The subclass strengthens a precondition.** Base accepts any `int`; subtype rejects negatives. Code that passed -1 to the base now fails on the subtype.
3. **The subclass weakens a postcondition or breaks an invariant.** The Square/Rectangle case — `setWidth` no longer leaves height untouched.
4. **Clients need `instanceof` / type checks** to handle subtypes differently — a dead giveaway the subtype isn't truly substitutable.

```java
// Violation: not every Bird flies
class Bird { void fly() {...} }
class Penguin extends Bird { void fly() { throw new UnsupportedOperationException(); } }

// Fix: model the real capability, don't inherit a promise you can't keep
interface Bird { void eat(); }
interface FlyingBird extends Bird { void fly(); }
class Sparrow implements FlyingBird { ... }
class Penguin implements Bird { ... }   // simply has no fly()
```

The fixes: (1) restructure the hierarchy so the subtype only inherits promises it can keep (split interfaces by capability — note the ISP overlap); (2) replace inheritance with composition/delegation; (3) make classes immutable value objects so there are no mutating invariants to violate. The mental test before subclassing: "**can I use a `Child` everywhere I use a `Parent` and have every existing caller still behave correctly?**" If you hesitate, it's has-a, not is-a.

### Q9. Can you over-apply SOLID? What does that look like?

Yes — SOLID is a set of heuristics with a cost, and maximising them blindly produces its own mess. Over-application looks like:

- **SRP taken to atoms**: every class has one method, so trivial behaviour is spread across a dozen classes and you can't read a flow without opening ten files. Cohesion drops; you've traded a fat class for a diffuse one.
- **DIP everywhere**: an interface for every class, even ones with a single implementation that will never change, plus a factory to create each. `IUserService` → `UserServiceImpl` with no second impl in sight — pure ceremony, harder to navigate.
- **OCP speculation**: abstracting variation axes that never vary. You build a plugin framework for "future payment types" and ship exactly one, paying indirection cost for a flexibility no one uses (YAGNI).
- **ISP shredding**: so many one-method interfaces that wiring anything requires assembling a dozen roles.

The result is **needless indirection**: to follow a single call you bounce through interfaces, factories, and injected strategies that each have one concrete path. That's a different kind of unmaintainable than a god class — the abstraction obscures rather than reveals.

The mature stance: apply SOLID **where change actually hurts**, guided by YAGNI and KISS. Add the interface when you have (or can clearly foresee) a second implementation; split the class when it's *actually* changing for multiple reasons; abstract the axis that *actually* varies. Start concrete; introduce abstraction when duplication or a real second case demands it. SOLID earns its keep against volatility, not against hypotheticals.

### Q10. Is SOLID a set of rules or guidelines? How dogmatic should you be?

**Guidelines** — heuristics that trade some upfront design cost for cheaper future change. They are a *means to an end* (code that's easy to change and reason about), never the end itself. Dogmatism inverts that: you start optimising the metric ("this class has two public methods, must split it") instead of the goal (is this code actually hard to change?).

The honest senior position: SOLID encodes hard-won lessons about what makes OO code rot, so the *default* should lean toward it — but every principle has a cost (indirection, more files, more concepts) that must be justified by real or clearly-anticipated change. The judgement call is always **"does applying this principle here make the code cheaper to change than the abstraction costs?"** For a stable, simple, one-implementation corner of the system, a concrete class with three responsibilities may be the *right* call — YAGNI beats speculative SRP.

Voice both sides in an interview: "I default to SOLID because it localises change, but I apply it reactively — I extract an interface when a second implementation appears or a test forces a seam, not preemptively. Over-applied, SOLID becomes AbstractFactoryFactory soup." That balance — principled but not dogmatic, aware of the cost — is exactly the senior signal interviewers are listening for. Even Uncle Martin frames them as principles to *lean on*, not laws to enforce.

### Q11. How would you refactor a "god class" that violates SRP?

A god class (a.k.a. blob) does everything — hundreds of lines, many unrelated fields, changed by every team. Refactor in **small, safe, behaviour-preserving steps** (Tidy First), not a big-bang rewrite.

The process:
1. **Characterise responsibilities.** Group its methods/fields by *reason to change* / actor: what's persistence, what's presentation, what's business rules, what's external I/O. Each cluster is a candidate class.
2. **Lean on tests first.** Add characterisation tests around the current behaviour so you can refactor without fear.
3. **Extract class per responsibility.** Move each cluster into its own cohesive class (`OrderValidator`, `OrderRepository`, `PricingCalculator`), leaving delegating calls behind so nothing breaks yet.
4. **Introduce interfaces at the seams** (DIP) so the god class — now a thin coordinator — depends on abstractions, and you can test pieces in isolation.
5. **Push logic to where the data lives** (fix feature envy / anemic model): if a method mostly manipulates another object's data, move it there (Tell-Don't-Ask).
6. **Shrink the original** to an orchestrator or delete it if it dissolves entirely.

```text
Before:                          After:
+------------------+             +----------------+   +------------------+
| OrderManager     |             | OrderService   |-->| OrderRepository  | (persistence)
| - validate()     |    ==>      | (coordinates)  |   +------------------+
| - calcPricing()  |             |                |-->| PricingCalculator| (rules)
| - saveToDb()     |             |                |-->| OrderValidator   | (validation)
| - sendEmail()    |             |                |-->| Notifier         | (delivery)
+------------------+             +----------------+   +------------------+
```

Key discipline: **separate refactoring commits from behaviour changes**, move in steps small enough to keep tests green throughout, and resist the urge to redesign while extracting. The god class shrinks toward a coordinator whose only job is wiring collaborators — often the strongest signal you've succeeded is that each extracted class is now independently testable.

### Q12. What is the Dependency Inversion Principle's relationship to dependency injection and IoC?

They're three layers of the same idea, often conflated:

- **DIP (principle)** — *what*: depend on abstractions, not concretions; point dependencies at stable interfaces.
- **IoC (Inversion of Control)** — *the general pattern*: don't construct/look up your own collaborators or control the flow — let something external do it. "Don't call us, we'll call you." DI is one form of IoC (frameworks calling your code, event loops, and template methods are others).
- **DI (mechanism)** — *how*: supply a class's collaborators from outside — constructor injection (preferred), setter, or interface injection — rather than `new`-ing them internally.

```java
// No DI, violates DIP: constructs its own concrete collaborator
class OrderService { private final MySqlRepo repo = new MySqlRepo(); }

// DI (constructor) realising DIP: abstraction injected from outside
class OrderService {
    private final OrderRepository repo;                 // abstraction (DIP)
    OrderService(OrderRepository repo) { this.repo = repo; }  // injection (DI)
}
// Composition root wires concretions: new OrderService(new MySqlOrderRepository());
```

The crucial distinction interviewers probe: **DI without DIP is possible** — if you inject a *concrete* class (`OrderService(MySqlRepo repo)`), you're doing DI but still depending on a detail, violating DIP. DIP requires the injected type to be an *abstraction*. And a DI container (Spring, Guice, Dagger) is just automation of DI — convenient, not required; you can hand-wire in a composition root and satisfy DIP perfectly. Summary: DIP is the goal, IoC is the philosophy, DI is the technique, a container is the tooling.

### Q13. Give a real-world example where following SRP made a system easier to change.

A concrete narrative interviewers like: a `UserRegistration` class that originally did validation, password hashing, database persistence, and welcome-email sending in one `register()` method.

The pain surfaced when three independent changes collided: security wanted to swap the hashing algorithm (bcrypt → argon2), the platform team migrated email from SMTP to a provider API, and the DBAs changed the user schema. All three edits landed in the *same* method, causing merge conflicts, and every change required re-testing the entire registration flow because everything was entangled.

Refactoring by reason-to-change:
```java
class RegistrationService {                    // orchestrates; one reason to change: the flow
    RegistrationService(UserValidator v, PasswordHasher h,
                        UserRepository r, WelcomeNotifier n) { ... }
    void register(SignupForm f) {
        v.validate(f);
        User u = new User(f.email(), h.hash(f.password()));
        r.save(u);
        n.notify(u);
    }
}
```
Now the security team edits only `PasswordHasher` (and its focused tests), platform edits only `WelcomeNotifier`, DBAs touch only `UserRepository`. Changes stopped colliding, each piece became independently testable (inject a fake `WelcomeNotifier` to test the flow without sending email), and the blast radius of any one change shrank to one class. The payoff of SRP is exactly this: **changes for different reasons stop stepping on each other**, which shows up as fewer conflicts, smaller test surfaces, and faster, safer edits.

### Q14. What is the difference between the Open/Closed Principle and just using inheritance?

OCP is the *goal* (extend without modifying); inheritance is *one mechanism* to reach it — and often not the best one. Conflating them leads to the anti-pattern of subclassing for every variation, which brings the fragile base class problem and rigid hierarchies.

The modern way to achieve OCP is usually **composition + interfaces (Strategy), not inheritance**:
```java
// OCP via inheritance (works, but rigid — deep hierarchy, fragile base):
abstract class Discount { abstract double apply(double p); }
class BlackFridayDiscount extends Discount { double apply(double p){ return p*0.5; } }

// OCP via composition/Strategy (preferred — swap at runtime, no hierarchy):
interface DiscountPolicy { double apply(double price); }
class Order {
    private DiscountPolicy discount;
    void setDiscount(DiscountPolicy d) { this.discount = d; }   // extend by injecting new policy
    double total() { return discount.apply(subtotal()); }
}
```
Both are "closed for modification, open for extension" — adding a `LoyaltyDiscount` touches no existing code. But the composition version lets you **swap behaviour at runtime**, combine policies, and avoid coupling to a base class's internals. Inheritance achieves OCP *statically* (chosen at compile time, one axis of variation, subject to LSP risks); composition achieves it *dynamically* and more flexibly. The principle is the same; the point is that OCP does **not** mean "use inheritance" — favour composition, reach for inheritance only when the is-a is genuine and substitutable. OCP is about designing *extension seams*; those seams are usually interfaces you compose, not base classes you extend.

### Q15. Which SOLID principle is most often violated in practice, and why?

A defensible answer is **Single Responsibility** — because it's the easiest to violate *by accretion*. No one sets out to write a god class; it grows one reasonable-looking method at a time. Each addition ("just add a `sendEmail` here, it's convenient") is locally sensible, so SRP erodes silently until the class is a 2000-line blob that every team edits and no test covers cleanly. Deadline pressure amplifies it — extracting a class *now* feels like overhead, so logic gets bolted onto whatever class is open.

**Dependency Inversion** is a strong runner-up: `new`-ing concrete dependencies inline is the path of least resistance, and the cost (untestable, welded to a technology) only bites later when you try to write a unit test or swap an implementation and discover you can't.

Why these two: both violations are *cheap in the moment and expensive later*, and both are invisible until change arrives. SRP and DIP violations don't fail any test the day you write them — they fail you months later as merge conflicts, untestable code, and change amplification. The senior takeaway is to watch for the early smells (a class growing a second reason to change, a `new ConcreteThing()` inside business logic) and fix them while the refactor is still a five-minute extract-class, not a two-week untangling. Prevention is cheap; the god class is not.

### Q16. How does SOLID relate to the GoF design patterns?

The patterns are SOLID **made concrete** — most GoF patterns are the canonical implementation of one or more principles. Understanding this turns the pattern catalogue from 23 things to memorise into obvious applications of five principles you already hold.

| Pattern | Primary principle it serves |
|---|---|
| Strategy | OCP (swap algorithms without editing), DIP (depend on the strategy interface) |
| Template Method | OCP (vary steps via subclassing), sits under LSP scrutiny |
| Factory Method / Abstract Factory | DIP (clients depend on abstract products), OCP (add products) |
| Decorator | OCP (add behaviour without modifying the class), SRP (one concern per decorator) |
| Observer | OCP (add observers freely), DIP (subject depends on an observer interface) |
| Adapter | ISP/DIP (make an incompatible interface conform to what the client needs) |
| Dependency Injection / Repository | DIP (inject abstractions) |

The through-line: **almost every pattern works by introducing an abstraction (interface) and depending on it, so that new behaviour is added by writing a new class rather than editing an old one.** That sentence is simultaneously the definition of OCP+DIP and the mechanism of Strategy, Observer, Decorator, Factory, State, Command, and more. LSP is the constant background condition — every pattern that swaps implementations assumes they're substitutable. So the honest framing for an interview: "the GoF patterns aren't separate knowledge from SOLID — they're the recurring shapes you get when you apply SOLID to specific variation problems. If I understand *why* Strategy exists (OCP for algorithms), I don't need to memorise it." That reframing is exactly the senior signal.
## Core Design Principles

### Summary

**What this topic covers**

The heuristics that sit above SOLID and beneath the GoF patterns — the working vocabulary a designer reaches for a hundred times a day. Four concern areas live here: (1) the **economy principles** — DRY, KISS, YAGNI, which govern how much design to spend; (2) the **structural principles** — composition over inheritance, program to an interface, encapsulate what varies, separation of concerns, which govern how objects are wired together; (3) the **conversational principles** — Law of Demeter and Tell-Don't-Ask, which govern how objects talk to each other; and (4) **GRASP** — the responsibility-assignment patterns (information expert, creator, controller, low coupling, high cohesion) that answer "which class should do this?" The 16 questions here are the day-to-day toolkit. SOLID (its own topic) is the formalisation; these are the folk wisdom that predates it and still gets used more often in a real code review.

**Mental model**

Principles are not rules — they are *forces* you balance. Every one of them can be over-applied into its own pathology: DRY taken too far couples unrelated code through a false abstraction; KISS taken too far ships a rigid design that can't flex; composition over inheritance taken too far produces a fog of tiny delegating classes. The senior move is to name the force, name the counter-force, and say where the line is *for this change*. The deeper unifying idea is **encapsulate what varies**: find the thing that changes, wrap it behind a stable interface, and let the rest of the system depend on the interface rather than the variation. Almost every principle here — and almost every GoF pattern — is a special case of that one sentence. Strategy encapsulates a varying algorithm; Factory encapsulates a varying construction; program-to-an-interface encapsulates a varying implementation. When you internalise "identify what changes and isolate it," the individual principles stop being a list to memorise and become one idea applied in different places.

**Key terms**

- **DRY** — Don't Repeat Yourself: every piece of *knowledge* has one authoritative representation. About knowledge duplication, not textual duplication.
- **KISS** — Keep It Simple: prefer the simplest design that works; complexity must earn its place.
- **YAGNI** — You Aren't Gonna Need It: don't build for speculative future requirements.
- **Composition over inheritance** — assemble behaviour by holding collaborators (has-a) rather than subclassing (is-a); more flexible, avoids the fragile base class.
- **Program to an interface** — depend on an abstraction (the type's contract), not a concrete class, so implementations can be swapped.
- **Law of Demeter** — "don't talk to strangers": a method should only call methods on its own fields, parameters, and objects it creates — not reach through chains.
- **Tell-Don't-Ask** — tell an object to do something rather than asking for its state and deciding for it; keeps behaviour with data.
- **Encapsulate what varies** — isolate the parts likely to change behind a stable interface.
- **Separation of concerns** — each module addresses one concern (persistence, rendering, business rules) so they evolve independently.
- **GRASP** — General Responsibility Assignment Software Patterns: information expert, creator, controller, low coupling, high cohesion, and more.

**Why interviewers ask this**

Anyone can recite "DRY." The signal is in the *judgement*. A junior applies principles as absolute rules and produces over-engineered code (a factory for a thing built once, an interface with one implementation forever). A senior treats them as trade-offs, cites the counter-force, and can point at code and say "this is a Demeter violation and here's why it hurts" or "this repetition is *incidental*, not knowledge duplication — leave it." Interviewers also probe whether you can connect a principle to a pattern ("what principle does Strategy serve?") and whether you know the failure modes (DRY-induced coupling, premature abstraction). The move that reads as senior: given a piece of code, name which principle it violates, what the concrete pain is, and the smallest refactor that fixes it — without dogma.

**Common confusions**

- "DRY means no duplicated lines" — DRY is about duplicated *knowledge*. Two identical lines representing two unrelated decisions are fine; deduplicating them creates coupling.
- "Composition over inheritance means never inherit" — inheritance is right for genuine is-a with LSP substitutability; the rule is a default, not a ban.
- "KISS and YAGNI are the same" — KISS is about the simplicity of what you build; YAGNI is about *whether* to build it at all.
- "Law of Demeter bans all method chaining" — it bans reaching through *other objects'* internals; a fluent builder that returns `this` is fine.
- "Tell-Don't-Ask means never use getters" — getters for genuine queries are fine; the smell is asking for state to make a decision that belongs inside the object.

**What follows from this topic**

These principles are the *why* behind everything downstream. **Coupling, Cohesion & Dependencies** formalises low-coupling/high-cohesion into measurable properties and adds dependency injection. **SOLID** is the crystallised, named version of encapsulate-what-varies and program-to-an-interface. Every **GoF pattern** is a principle made concrete: master these and the patterns become predictable rather than arbitrary. When you later ask "which pattern?", the honest answer is usually "whichever one encapsulates the thing that's varying here."

### Q1. What are DRY, KISS, and YAGNI, and how do they trade off against each other?

**DRY (Don't Repeat Yourself)** — every piece of *knowledge* has a single authoritative source. The subtlety: it's about knowledge, not text. Two methods with similar-looking code that encode *different business rules* are not a DRY violation — merging them couples two things that change for different reasons.

**KISS (Keep It Simple)** — prefer the simplest solution that satisfies the requirement. Complexity is a cost you pay every time someone reads the code; make it earn its keep.

**YAGNI (You Aren't Gonna Need It)** — don't implement speculative features or extension points for requirements you don't have yet. The future rarely arrives in the shape you predicted.

They pull against each other in a productive tension:

| Force | Pushes toward | Over-applied becomes |
|---|---|---|
| DRY | Abstraction, shared code | False abstraction, coupling unrelated code |
| KISS | Fewer moving parts | Copy-paste, under-abstraction |
| YAGNI | Building only what's needed | Ripping out genuinely-needed seams |

The classic clash is **DRY vs YAGNI**: you see two similar chunks and want to extract a shared abstraction (DRY), but abstracting now bets on a future shape you can't see (YAGNI). The senior heuristic is the **Rule of Three** — duplicate twice, extract on the third occurrence, when you actually know the axis of variation. Premature DRY is worse than duplication because coupling is harder to undo than copy-paste.

### Q2. "DRY means no duplicated code." Why is that wrong?

Because DRY is about **duplicated knowledge**, not duplicated *text*. The canonical formulation (Hunt & Thomas): "Every piece of knowledge must have a single, unambiguous, authoritative representation within a system."

Consider two constants that both happen to equal `30`:

```python
DEFAULT_SESSION_TIMEOUT = 30   # seconds a login session survives idle
FREE_TIER_UPLOAD_LIMIT  = 30   # max files an unpaid user can upload
```

Textually identical. But they encode *two independent decisions* — different stakeholders, different reasons to change. "Deduplicating" them into one shared `THIRTY = 30` is a bug waiting to happen: raise the upload limit and you silently change every session timeout. This is **incidental** (coincidental) duplication — leave it alone.

The inverse is **knowledge** duplication that *doesn't* look duplicated:

```python
# in the API layer
if user.age >= 18: allow()
# in the report generator, days later
adults = [u for u in users if u.birth_year <= this_year - 18]
```

Two different expressions of the *same* rule ("adult = 18+"). That's the real DRY violation — one `is_adult(user)` should own it. The test is not "do these look alike?" but "if the business rule changes, must both sites change together?"

### Q3. What does "composition over inheritance" mean? Show a refactor.

Inheritance expresses **is-a** and binds a subclass to its parent at compile time — you inherit *all* of the parent, including future changes to it (the **fragile base class** problem). Composition expresses **has-a**: an object holds a collaborator and delegates to it, so behaviour is assembled at runtime and swappable.

The classic trap is modelling *behavioural variation* with an inheritance tree. Say ducks quack and fly:

```java
// BEFORE — inheritance explosion
abstract class Duck {
    abstract void quack();
    abstract void fly();
}
class MallardDuck extends Duck { void quack(){...} void fly(){...} }
class RubberDuck extends Duck {
    void quack(){ /* squeak */ }
    void fly(){ throw new UnsupportedOperationException(); } // rubber ducks don't fly!
}
```

`RubberDuck` inherits a `fly()` it must sabotage — an LSP violation, and every new combination (flying-but-mute, decoy) forces a new subclass. The behaviours are *varying independently*, so make them collaborators (this is the Strategy pattern):

```java
// AFTER — composition
interface FlyBehavior  { void fly(); }
interface QuackBehavior { void quack(); }

class Duck {
    private FlyBehavior fly;
    private QuackBehavior quack;
    Duck(FlyBehavior f, QuackBehavior q) { this.fly = f; this.quack = q; }
    void performFly()   { fly.fly(); }
    void performQuack() { quack.quack(); }
    void setFly(FlyBehavior f) { this.fly = f; } // change behaviour at RUNTIME
}

Duck mallard = new Duck(new FlyWithWings(), new LoudQuack());
Duck rubber  = new Duck(new NoFly(),        new Squeak());
```

```text
+----------+        +--------------+
|   Duck   |<>----->| FlyBehavior  |  (interface)
|          |<>----->| QuackBehavior|
+----------+        +--------------+
                          ^
                   <|.. FlyWithWings, NoFly ...
```

Now behaviours mix freely, are testable in isolation, and are swappable at runtime. **When to still use inheritance**: a genuine is-a where the subtype is fully substitutable (LSP holds) and you're sharing a stable contract, not varying behaviour.

### Q4. What does "program to an interface, not an implementation" mean?

Depend on the **abstraction** (the smallest contract you actually need) rather than a concrete class. Concretely: declare variables, parameters, and return types as the interface, and confine the concrete type to the single point of construction.

```java
// coupled to a concrete class — swapping it is a code change everywhere
ArrayList<Order> orders = new ArrayList<>();
void process(ArrayList<Order> orders) { ... }

// programmed to an interface — implementation is swappable
List<Order> orders = new ArrayList<>();      // could become LinkedList, unmodifiableList...
void process(List<Order> orders) { ... }     // callers can pass anything List-shaped
```

The payoff is **substitutability**: tests inject a fake, production injects the real thing, and a new implementation ships without touching consumers. It's the enabling principle behind the Open/Closed Principle and Dependency Inversion — code depends on a stable contract while implementations vary beneath it.

Two cautions. First, "interface" here means *abstract type*, not necessarily a Java `interface` keyword — an abstract base or even a well-defined public surface counts. Second, don't reflexively extract an interface for every class (YAGNI): the value appears when there's a *real* second implementation, a test seam, or a stable boundary you're deliberately drawing. One interface with one permanent implementation is just indirection.

### Q5. Explain the Law of Demeter. Show a violation and a fix.

The **Law of Demeter** (LoD), or "don't talk to strangers," says a method `m` on object `O` should only invoke methods on: (1) `O` itself, (2) `m`'s parameters, (3) objects `m` creates, and (4) `O`'s direct fields. It should *not* reach through a returned object to call methods on *its* internals.

```java
// VIOLATION — a train wreck reaching through three objects
public void charge(Order order) {
    order.getCustomer().getWallet().deduct(order.total()); // talking to strangers
}
```

The caller now depends on `Customer` having a `Wallet` having a `deduct` — three classes' internal structure. Change any of those shapes and this breaks. The fix is **Tell-Don't-Ask**: push the behaviour to the object that owns the data.

```java
// FIX — tell the order to pay; it delegates internally
public void charge(Order order) { order.pay(); }

class Order {
    void pay() { customer.pay(total()); }        // Order only talks to its own field
}
class Customer {
    void pay(Money amount) { wallet.deduct(amount); } // Customer owns its Wallet
}
```

Each object only talks to its immediate collaborators, so structural changes stay local. **The nuance interviewers want**: LoD is about *object graphs*, not syntax. `builder.setX().setY().build()` chains fine because each call returns the *same* builder (a fluent interface), not a stranger. And a data-transfer object / stream pipeline (`list.stream().filter().map()`) is exempt — those are pure queries over a collection, not commands reaching through a domain object's guts. Applied dogmatically LoD spawns endless wrapper/delegation methods ("Demeter tax"); apply it where reaching through *behavioural* objects creates coupling.

### Q6. What is Tell-Don't-Ask and how does it relate to encapsulation?

**Tell-Don't-Ask**: instead of asking an object for its data and then making a decision *about* that object, tell the object what you want and let it decide. It keeps behaviour next to the data it operates on — the essence of encapsulation.

```java
// ASK — logic about Account lives outside Account (anemic)
if (account.getBalance() >= amount) {
    account.setBalance(account.getBalance() - amount);
} else {
    throw new InsufficientFundsException();
}

// TELL — Account owns the rule that governs its own state
account.withdraw(amount); // throws InsufficientFundsException internally
```

The "ask" version scatters the withdrawal rule across every caller; the balance-check invariant isn't protected by the class, so any caller can forget it or get it wrong. The "tell" version makes `Account` responsible for its own invariants — the rule has exactly one home. This is how you avoid the **anemic domain model** (data bags with all logic in services).

The caveat: Tell-Don't-Ask is a heuristic, not an absolute. Genuine *queries* — "what's the balance?" for display, filtering a collection, reporting — legitimately ask for state. The smell is asking for state to make a *decision that mutates or validates* that same object; that decision belongs inside it.

### Q7. What is "separation of concerns" and how do you apply it?

**Separation of concerns (SoC)** means each part of a system addresses a single concern — a distinct axis of the problem — so concerns can be understood, changed, and tested independently. A "concern" is anything the software cares about: persistence, presentation, business rules, validation, logging, authorization.

The everyday application is **layering**: keep business logic out of the UI, keep SQL out of the domain, keep HTTP concerns at the edge.

```text
+------------------+   presentation concern (rendering, input)
|   Controller/UI  |
+------------------+
         |  depends on
+------------------+   domain concern (business rules, invariants)
|   Service/Domain |
+------------------+
         |  depends on (through an interface)
+------------------+   persistence concern (storage, queries)
|   Repository     |
+------------------+
```

The smell of *mixed* concerns: a method that builds an HTML string, computes a discount, *and* runs a SQL query. Change the discount rule and you risk breaking the markup; you can't unit-test the pricing without a database. Splitting them means each changes for one reason (this is Single Responsibility at the module level) and each is testable alone. SoC is what makes SOLID, hexagonal architecture, and MVC all feel like the same idea at different scales.

### Q8. What is GRASP, and what is the "information expert" pattern?

**GRASP** (General Responsibility Assignment Software Patterns, from Larman) is a set of nine principles for the fundamental OOD question: *which class should have this responsibility?* SOLID tells you properties a good design has; GRASP tells you *how to assign* responsibilities to get there. The core five interviewers care about:

- **Information Expert** — assign a responsibility to the class that has the *information* needed to fulfil it.
- **Creator** — class B should create A if B contains/aggregates/closely uses A or has A's initialising data.
- **Controller** — route system events through a coordinating object (a use-case controller or facade), not the UI.
- **Low Coupling** — assign responsibilities to minimise dependencies between classes.
- **High Cohesion** — keep each class focused on a related set of responsibilities.

**Information Expert** in practice — who computes an order's total?

```java
// The Order HAS the line items, so the Order is the expert on its total.
class Order {
    private List<LineItem> items;
    Money total() {
        return items.stream().map(LineItem::subtotal)
                    .reduce(Money.ZERO, Money::plus);
    }
}
class LineItem {
    Money subtotal() { return price.times(quantity); } // LineItem is expert on ITS subtotal
}
```

A service class computing the total by pulling `order.getItems()` and looping outside would violate Information Expert (and Tell-Don't-Ask) — the data and the logic drift apart. Put the calculation where the data lives: it lowers coupling (nobody needs to see the items list) and raises cohesion.

### Q9. How do the principles of "Creator" and "Controller" guide design?

**Creator** answers "which class should be responsible for `new`-ing up an object?" Assign the creation of `A` to class `B` when one or more holds: B *aggregates or contains* A, B *records* A, B *closely uses* A, or B has the *initialising data* A needs. Following Creator keeps object construction where the natural relationships already are, and prevents scattering `new` calls arbitrarily.

```java
class Order {                       // Order contains LineItems -> Order creates them
    private List<LineItem> items = new ArrayList<>();
    void addLine(Product p, int qty) {
        items.add(new LineItem(p, qty)); // Order is the Creator of LineItem
    }
}
```

If creation logic gets complex (variants, families, expensive setup), Creator points toward promoting it into a dedicated **Factory** — which is exactly the bridge to the creational-patterns topic.

**Controller** answers "what first object beyond the UI receives a system operation?" Don't let the UI/view call domain objects directly and orchestrate the workflow — route the request through a **controller**: either a *use-case controller* (`PlaceOrderHandler`) or a *facade controller* representing the whole subsystem. This keeps UI thin, centralises use-case coordination, and makes the workflow testable without the UI. The anti-pattern it prevents is the "smart UI" where the button click handler contains the business process.

### Q10. How do low coupling and high cohesion appear as GRASP principles?

They are the two GRASP principles that act as *evaluative* tie-breakers: when several responsibility assignments are possible, pick the one that lowers coupling and raises cohesion.

**Low Coupling** — minimise how many other classes a class must know about. Fewer, more stable dependencies mean a change ripples less far and classes are reusable in isolation. Practically: prefer depending on an interface over a concrete class; don't create a dependency just to reach a convenience method.

**High Cohesion** — keep a class's responsibilities tightly related to a single purpose. A cohesive class is easy to name ("it's the thing that does X"); a low-cohesion class needs "and" to describe it ("handles orders *and* sends email *and* formats reports").

```text
Low cohesion (bad)              High cohesion (good)
+--------------------+          +-----------+  +--------------+  +-------------+
|   OrderManager     |          |   Order   |  | EmailService |  | InvoicePdf  |
| - calcTotal()      |   --->   | -total()  |  | - send()     |  | - render()  |
| - sendEmail()      |          +-----------+  +--------------+  +-------------+
| - renderInvoice()  |
| - saveToDb()       |
+--------------------+
```

The two forces are usually allies (a focused class naturally depends on less) but can conflict: aggressively splitting for cohesion can add coordination coupling between the pieces. The full treatment — coupling *types* and cohesion *levels* — is the next topic.

### Q11. What does "encapsulate what varies" mean, and why is it the meta-principle?

**Encapsulate what varies**: identify the aspect of your application that changes, and separate it from what stays the same by hiding it behind a stable interface — so a change to the varying part doesn't ripple into the stable part.

It's the meta-principle because nearly every other principle and pattern is a *specialisation* of it:

| The thing that varies | The pattern/principle that encapsulates it |
|---|---|
| An algorithm | Strategy |
| Which concrete class to create | Factory Method / Abstract Factory |
| The steps of an algorithm's skeleton | Template Method |
| An object's response to state | State |
| The implementation of a contract | Program to an interface |
| Behaviour added to an object | Decorator |

The design move is always the same three steps: (1) spot the axis of change (this discount will grow to ten kinds; this storage will be Postgres then also S3), (2) name the stable contract that covers all variants (`DiscountPolicy`, `BlobStore`), (3) push each variant behind that contract so the rest of the code depends on the contract only. The discipline it demands is *not* encapsulating what *doesn't* vary — that's YAGNI's job — so the skill is predicting the real axis of change, not every conceivable one.

### Q12. Give an example of DRY taken too far. What goes wrong?

DRY over-applied creates a **false abstraction**: code that looks shared but represents concepts that only *coincidentally* coincide today. The failure mode is coupling — you've tied together two things that will need to change independently, and now every change to one drags the other.

```python
# "DRY" — one function serving two callers that looked similar
def format_entity(entity, kind):
    if kind == "invoice":
        return f"{entity.number}: ${entity.total:.2f} due {entity.due_date}"
    elif kind == "receipt":
        return f"{entity.number}: ${entity.total:.2f} paid {entity.paid_date}"
    elif kind == "quote":          # every new caller adds a branch...
        return f"{entity.number}: ${entity.total:.2f} valid until {entity.expiry}"
```

The `kind` flag and the branching are the tell. What began as "these three strings share a `number: $total` prefix" became a switchboard that every entity's formatting change must edit — a **shotgun-surgery** magnet, and a magnet for merge conflicts. The prefix similarity was *incidental*; the formatting rules are genuinely independent knowledge.

The fix is to *undo* the premature merge — let each have its own formatter, and if a real shared rule emerges (money formatting), extract *that* narrow piece:

```python
def money(amount): return f"${amount:.2f}"          # the ACTUAL shared knowledge
def format_invoice(inv): return f"{inv.number}: {money(inv.total)} due {inv.due_date}"
def format_receipt(rcpt): return f"{rcpt.number}: {money(rcpt.total)} paid {rcpt.paid_date}"
```

Sandi Metz's rule of thumb captures it: **"duplication is far cheaper than the wrong abstraction."** When an abstraction starts sprouting flags and conditionals to serve divergent callers, that's the signal to inline it back and re-derive the right seam.

### Q13. When does inheritance actually beat composition?

Composition is the default, but inheritance is the right tool when three conditions all hold:

1. **Genuine is-a with substitutability (LSP holds)** — a `Square` truly is a `Rectangle` *for every operation callers rely on*. If any inherited operation must be sabotaged or throw, it's not a real is-a.
2. **You're sharing a stable contract/skeleton, not varying behaviour** — the base defines an invariant algorithm and subclasses fill in steps. This is the **Template Method** pattern, where inheritance is exactly right:

```java
abstract class DataImporter {
    public final void importData() {   // stable skeleton, final = can't be overridden
        var raw = read();              // varying step
        var clean = validate(raw);     // varying step
        save(clean);                   // varying step
    }
    protected abstract List<Row> read();
    protected abstract List<Row> validate(List<Row> raw);
    protected abstract void save(List<Row> rows);
}
class CsvImporter extends DataImporter { /* fill in read/validate/save */ }
```

3. **The hierarchy is shallow and closed** — one level, a known set of subtypes, unlikely to combine along multiple independent axes (multiple axes are the signal to switch to composition, à la the Duck example).

The decisive question: *"Do I want to inherit the parent's future changes?"* With inheritance you're coupled to the base forever (fragile base class); with composition you only depend on a narrow interface. If the answer is "I want to reuse *some* code but not be bound to this type," that's composition/delegation, not inheritance.

### Q14. How do design principles guide which pattern to choose?

Patterns aren't picked from a catalogue by name — they *fall out* of applying principles to a specific force. The workflow: name what's varying, name the principle that says to isolate it, and the pattern is usually the standard encapsulation of that variation.

| The problem you're feeling | Principle invoked | Pattern it points to |
|---|---|---|
| "This algorithm has 5 variants and I'm switching on a type flag" | Encapsulate what varies; OCP | **Strategy** |
| "`new ConcreteX()` is hard-coded and I need to swap implementations" | Program to an interface; DIP | **Factory Method / DI** |
| "An object behaves totally differently per mode, with messy state flags" | Encapsulate what varies | **State** |
| "Callers reach through my object graph" | Law of Demeter; Tell-Don't-Ask | **Facade** |
| "I want to add responsibilities without a subclass explosion" | Composition over inheritance; OCP | **Decorator** |
| "Many objects need to react to one object's changes" | Low coupling | **Observer** |

The anti-pattern is the reverse: falling in love with a pattern and hunting for somewhere to install it (**"golden hammer"**). That's how you get a Singleton for a thing created once, a factory with one product, or an AbstractStrategyFactoryManager for two if-branches. The honest senior answer to "which pattern?" is often "none yet — the simplest thing that works, and I'll reach for a pattern when a *second* variant proves the axis of change is real." Principles come first; patterns are their reusable crystallisations.

### Q15. What's the difference between KISS and YAGNI in practice?

They're cousins but aim at different targets:

- **KISS** governs the *shape* of what you build — given that you're building X, build the simplest X that works. It's about avoiding needless complexity in a *committed* piece of work.
- **YAGNI** governs *whether* you build something at all — don't build X yet if no current requirement needs it. It's about avoiding *speculative* work.

```java
// YAGNI violation — building a plugin system for one payment method that exists today
interface PaymentGatewayPlugin { ... }
class PluginRegistry { ... }
class PluginLoader { ... }
Stripe stripe = pluginLoader.load("stripe"); // ...to call one hard-coded gateway

// KISS violation — needlessly clever for a simple committed requirement
boolean isEven = ((n & 1) ^ 1) == 1;         // just write: n % 2 == 0
```

The YAGNI case isn't complex *in itself* — each plugin class is simple — but the *whole apparatus* is unnecessary work for a requirement that doesn't exist. The KISS case is a single committed line made harder to read than it needs to be. You can violate one without the other: over-engineered-but-each-part-simple (YAGNI), or minimal-scope-but-cryptic (KISS). Together they say: build only what you need (YAGNI), and build it as plainly as possible (KISS).

### Q16. You inherit a class you call a "god object." Which principles do you apply to fix it, and how?

A **god object** concentrates too many responsibilities — it knows about and does everything, so every feature touches it and nothing can be tested or changed in isolation. It's the poster child for *low cohesion* and *high coupling* at once. The refactor is principle-driven and incremental (**Tidy First** — small safe steps, behaviour-preserving):

**1. Identify concerns (Separation of Concerns / High Cohesion).** Read the methods and cluster them by what data they touch and why they'd change. `OrderManager` doing pricing + persistence + email + PDF is four concerns wearing a trench coat.

**2. Extract classes along those seams (Information Expert).** Move each cluster to the class that owns its data. Pricing goes to `Order`/`PricingService`, persistence to `OrderRepository`, notification to `NotificationService`. Each new class is named without "and."

```text
BEFORE                          AFTER
+------------------+            +-------+  +-----------------+  +---------------------+
|   OrderManager   |            | Order |  | OrderRepository |  | NotificationService |
| everything...    |   ---->    +-------+  +-----------------+  +---------------------+
+------------------+                 ^ god object dissolved into cohesive collaborators
```

**3. Invert the dependencies (Program to an Interface / DIP).** Have the coordinator depend on `OrderRepository` and `NotificationService` *interfaces*, injected in — so pieces are swappable and testable with fakes.

**4. Push behaviour into the domain (Tell-Don't-Ask).** Any logic that was reading the god object's fields to decide something moves *into* the object that owns those fields, killing the anemic-model smell.

**5. Keep steps reversible and green.** Extract one concern, run the tests, commit; repeat. Never one big-bang rewrite — a god object usually has poor test coverage, so add characterization tests around the seam *before* moving code. The endpoint: a thin coordinator plus several cohesive, loosely-coupled classes, each with one reason to change.

## Coupling, Cohesion & Dependencies

### Summary

**What this topic covers**

The two properties that most predict whether a codebase is a pleasure or a nightmare to change — **coupling** (how much modules depend on each other) and **cohesion** (how focused each module is) — plus the machinery for controlling dependency *direction*: **Dependency Injection** and **Inversion of Control**. Four concern areas: (1) the **coupling taxonomy** — content, common, control, stamp, data — ranked worst to best; (2) the **cohesion spectrum** — coincidental up to functional; (3) **dependency management** — DI (constructor/setter/interface), IoC, containers, and the Dependency Inversion boundary; and (4) **stability & measurement** — the stable-dependencies principle and how to actually spot bad coupling in a real codebase. The 15 questions here turn the vague advice "low coupling, high cohesion" into named, gradable, actionable properties you can point at in a code review.

**Mental model**

Picture your system as a graph: nodes are modules, edges are dependencies. **Coupling** is about the *edges* — how many, how thick, and in which direction. **Cohesion** is about what's *inside each node* — does everything in this box belong together? The goal isn't zero coupling (that's isolated islands that can't collaborate) but *loose, deliberate, one-directional* coupling on *stable* abstractions. The single most powerful idea is **dependency inversion**: high-level policy shouldn't depend on low-level detail; both should depend on an abstraction, and you arrange for the abstraction to be *owned by the high-level side*. This flips the naive dependency arrow — instead of `BusinessLogic -> Database`, you get `BusinessLogic -> IRepository <- Database`. The database now depends on the business layer's contract, not vice versa. DI and IoC are just the *mechanics* of achieving that flip: something other than the object itself decides which concrete collaborator it gets. Master the graph view and code review becomes "trace the arrows and ask which point the wrong way."

**Key terms**

- **Coupling** — the degree to which one module depends on the internals of another.
- **Cohesion** — the degree to which a module's parts belong together toward one purpose.
- **Content coupling** — one module reaches into another's internals (worst).
- **Data coupling** — modules share only simple parameters (best).
- **Dependency Injection (DI)** — a collaborator is *supplied* to an object rather than constructed by it.
- **Inversion of Control (IoC)** — the framework/container calls your code and controls object creation & flow, not vice versa ("don't call us, we'll call you").
- **Dependency Inversion Principle (DIP)** — depend on abstractions; make details depend on policy, not the reverse.
- **DI container** — a tool that wires and supplies dependencies automatically (Spring, Guice, .NET DI).
- **Stable-dependencies principle** — depend in the direction of *stability*; a volatile module shouldn't be depended upon by many.
- **Afferent / efferent coupling (Ca/Ce)** — how many modules depend *on* you vs how many you depend *on*; drives the instability metric.

**Why interviewers ask this**

"Low coupling, high cohesion" is the most-quoted and least-understood advice in OOD. The junior recites it; the senior can *grade* a class ("this is control coupling because you pass a boolean flag that switches its behaviour") and prescribe the fix. Interviewers use this to test whether you can reason about *change propagation* — the real cost of software — rather than local correctness. DI/IoC questions specifically separate people who've only used a framework's `@Autowired` magic from people who understand *why* it exists (testability, swappability, inverting the dependency arrow) and can do it by hand. The senior signal: given a design, predict what a change will ripple into, name the coupling that causes the ripple, and invert the dependency to contain it.

**Common confusions**

- "Coupling is always bad" — *some* coupling is how objects collaborate; the goal is loose coupling on stable abstractions, not none.
- "DI means using a DI container" — DI is just passing dependencies in; a container automates it but plain constructor arguments are DI too.
- "Dependency Injection and Dependency Inversion are the same" — DI is the *mechanism* (supply the collaborator); DIP is the *principle* (depend on abstractions, invert the arrow). You can do DI without inverting anything.
- "IoC is a Spring thing" — IoC is a general principle (event loops, template methods, callbacks all invert control); DI is one kind of IoC.
- "High cohesion means small classes" — cohesion is about *relatedness*, not size; a large class can be highly cohesive and a tiny one incidentally cohesive.

**What follows from this topic**

This is the measurable core of **Core Design Principles** — GRASP's low-coupling/high-cohesion made gradable. It's the engine of **SOLID**: the Dependency Inversion Principle *is* the dependency-direction discussion here, and Single Responsibility *is* high cohesion. Every **creational pattern** downstream exists partly to reduce coupling to concrete classes (a Factory decouples callers from `new ConcreteX()`). And DI is the delivery mechanism that makes "program to an interface" actually happen at runtime.

### Q1. What is coupling and what is cohesion? Why do we want low coupling and high cohesion?

**Coupling** measures how strongly one module depends on another — how much it must know about another's internals, and how much a change in one forces a change in the other. **Cohesion** measures how strongly the elements *within* a single module belong together toward one clear purpose.

The rhyme is **low coupling, high cohesion**, and both serve the same master: the cost of *change*.

- **High cohesion** means a class has one reason to change and is easy to name, understand, reuse, and test. When everything in a class relates to one job, a requirement change touches one place.
- **Low coupling** means a change in one module doesn't cascade into many others. Modules can be understood, tested, deployed, and replaced in isolation.

```text
BAD: tight coupling, low cohesion       GOOD: loose coupling, high cohesion
+-------+   +-------+                    +-------+       +-----------+
|   A   |<->|   B   |   every box        |   A   |----+  |    C      |
|  ...  |<->|  ...  |   knows every      +-------+    |  +-----------+
+-------+   +-------+   other box            |        +->| Interface |<--+
    ^  \   /    ^        (change            +---------->|___________|   |
    |   \ /     |         ripples)                                   [impl D]
+-------+ X +-------+
|   C   |<->|   D   |
+-------+   +-------+
```

They're related: a cohesive module naturally exposes a small surface, which makes it easy to couple to *loosely*. A grab-bag class forces everyone to depend on the whole grab-bag. The goal is never *zero* coupling — objects must collaborate — but coupling that is loose, deliberate, and pointed at stable abstractions rather than volatile internals.

### Q2. Name the types of coupling from worst to best.

There's a classic ranked spectrum (Yourdon & Constantine). Worst (tightest) at the top:

| Type | What it is | Why it's bad |
|---|---|---|
| **Content** (pathological) | Module A reaches *into* B's internals — modifies its private data, jumps into its code | Any change to B's internals breaks A; encapsulation is gone |
| **Common** | Modules share global mutable state | Anyone can change the global; ripple + concurrency hazards; hard to trace |
| **External** | Modules share an externally-imposed format/protocol/device | Coupled to an external detail that may change |
| **Control** | A passes B a flag that controls *which* logic B runs | A knows B's internal logic; changing B's branches changes A |
| **Stamp** (data-structured) | A passes B a whole record when B needs only one field | B depends on the whole structure's shape; false coupling to unused fields |
| **Data** | A passes B only the simple parameters B actually needs | Minimal, explicit dependency — the goal |

Below data coupling some add **message coupling** (interaction only via public method calls with no parameters/shared data) as the loosest of all. The practical takeaway: push everything down this table. A boolean flag argument (control coupling) becomes two methods or a strategy object; passing a whole `User` object where you need only the `email` (stamp coupling) becomes passing the `email` string (data coupling). And a global singleton (common coupling) becomes an injected dependency.

### Q3. Show content coupling and control coupling in code, and fix them.

**Content coupling** — reaching into another object's internals:

```java
// CONTENT COUPLING — Report pokes at Cart's private list directly
class Cart { List<Item> items = new ArrayList<>(); }   // exposed field
class Report {
    double total(Cart cart) {
        double t = 0;
        for (Item i : cart.items) t += i.price;         // reaching inside Cart
        cart.items.clear();                             // mutating Cart's internals!
        return t;
    }
}
```

`Report` depends on `Cart` storing items in a public mutable `List` and even mutates it. Change `Cart`'s storage and `Report` breaks. **Fix**: encapsulate — `Cart` exposes behaviour, not its guts (Tell-Don't-Ask):

```java
class Cart {
    private final List<Item> items = new ArrayList<>();
    Money total() { return items.stream().map(Item::price).reduce(Money.ZERO, Money::plus); }
    void checkout() { items.clear(); }
}
double t = cart.total().amount();   // Report no longer knows how Cart stores anything
```

**Control coupling** — passing a flag that steers the callee's logic:

```java
// CONTROL COUPLING — the caller must know PriceCalc's internal branches
Money price = calc.compute(order, true);  // what is `true`? "isPremium"? caller knows too much
```

**Fix** — replace the flag with polymorphism (Strategy) or split the method:

```java
Money price = premiumPricing.compute(order);   // intent explicit; PriceCalc's branches hidden
// or: calc.computeStandard(order) / calc.computePremium(order)
```

The general moves: content coupling → **encapsulate**; control coupling → **replace the flag with a type** (a strategy or a subtype), removing the caller's knowledge of the callee's internal decision tree.

### Q4. What are the levels of cohesion, from worst to best?

The mirror-image spectrum to coupling. Worst (least related) at the top:

| Level | Elements grouped because... | Verdict |
|---|---|---|
| **Coincidental** | ...no meaningful reason ("Utils" dumping ground) | Worst — arbitrary |
| **Logical** | ...they're the same *category* of action, selected by a flag | Bad — control coupling built in |
| **Temporal** | ...they happen at the same *time* (e.g. `init()` doing 5 unrelated setups) | Weak |
| **Procedural** | ...they follow one another in a control flow | Weak-ish |
| **Communicational** | ...they operate on the *same data* | OK |
| **Sequential** | ...one's output is the next's input (a pipeline) | Good |
| **Functional** | ...they all contribute to *one single well-defined task* | Best — the goal |

**Coincidental** is the `MiscUtils` / `Helpers` class everyone dumps into — the name can't describe it. **Functional** is the ideal: `TaxCalculator.calculate()` does exactly one thing and every member serves it.

```java
// COINCIDENTAL cohesion — unrelated stuff sharing a class
class Helper {
    static String formatDate(Date d) {...}
    static double calcTax(Order o) {...}
    static void sendEmail(String to) {...}   // nothing to do with the others
}
// FUNCTIONAL cohesion — one job, every member serves it
class TaxCalculator {
    Money calculate(Order o) {...}
    private Rate rateFor(Region r) {...}      // supports the one job
}
```

The practical test: try to name the class *without using "and" or "misc/manager/util."* If you can't, cohesion is low. Raising cohesion is the same move as fixing a god object — split along the axes of unrelated responsibility.

### Q5. What is Dependency Injection? Show the three forms.

**Dependency Injection (DI)** is a technique where an object receives its collaborators from the outside instead of creating them itself. "Don't `new` your dependencies; ask for them." The point is decoupling: the class depends on an *abstraction* and doesn't control which concrete implementation it gets, which makes it swappable and testable.

```java
// WITHOUT DI — OrderService is welded to concrete classes; untestable in isolation
class OrderService {
    private final SmtpEmailer emailer = new SmtpEmailer();   // hard-coded, sends real email in tests
    private final PostgresRepo repo   = new PostgresRepo();  // needs a real DB to test
}
```

**The three injection styles:**

```java
// 1. CONSTRUCTOR injection (preferred) — dependencies are mandatory & final
class OrderService {
    private final Emailer emailer;
    private final OrderRepo repo;
    OrderService(Emailer emailer, OrderRepo repo) {   // supplied in
        this.emailer = emailer; this.repo = repo;
    }
}
new OrderService(new SmtpEmailer(), new PostgresRepo()); // prod
new OrderService(new FakeEmailer(), new InMemoryRepo()); // test

// 2. SETTER injection — optional/reconfigurable dependencies
class OrderService {
    private Emailer emailer;
    void setEmailer(Emailer e) { this.emailer = e; }
}

// 3. INTERFACE injection — an interface defines the inject method (rare)
interface EmailerAware { void injectEmailer(Emailer e); }
```

| Form | Use when | Downside |
|---|---|---|
| **Constructor** | Required deps; want immutability | Many deps = long constructor (itself a smell) |
| **Setter** | Optional / swappable at runtime | Object can exist half-configured |
| **Interface** | Framework mandates a callback | Verbose; rarely used |

**Default to constructor injection**: it makes dependencies explicit and mandatory, allows `final` fields (immutability, thread-safety), and a bloated constructor honestly signals a class with too many responsibilities.

### Q6. What is Inversion of Control, and how does it relate to DI?

**Inversion of Control (IoC)** is the general principle that the *flow of control* — and the decision of *what runs when* and *which objects get created* — is handed to a framework or container rather than your own code. The slogan is the **Hollywood Principle**: "Don't call us, we'll call you." In a traditional program *your* code calls into libraries; under IoC, the framework holds the main loop and calls *your* code at the right moments.

IoC is the broad category; **DI is one specific kind of IoC** — specifically, inversion of *dependency construction*. Other forms of IoC:

- **Template Method** — the base class owns the algorithm skeleton and calls *down* into your overridden steps (control inverted to the base).
- **Event loops / callbacks** — the loop decides when to invoke your handler.
- **The Strategy/Observer wiring** — the framework decides when to notify.

```java
// NON-inverted: you drive
public static void main(String[] a) {
    var svc = new OrderService(new SmtpEmailer(), new PostgresRepo()); // you construct + call
    svc.placeOrder(...);
}

// Inverted (DI container): the container constructs & wires; it calls you
@Service
class OrderService {
    OrderService(Emailer e, OrderRepo r) { ... }   // container injects, you never `new` these
}
```

The relationship in one line: **IoC is the "what" (control is inverted); DI is one "how" (dependencies are supplied to you rather than created by you).** You can achieve DI *without* a container — plain constructor arguments wired in `main` is DI — the container just automates the wiring at scale.

### Q7. Explain the Dependency Inversion Principle. Isn't it the same as Dependency Injection?

No — and this is the confusion interviewers probe. **Dependency Inversion Principle (DIP)** is the "D" of SOLID, a *design principle* about dependency *direction*:

1. High-level modules should not depend on low-level modules; both should depend on **abstractions**.
2. Abstractions should not depend on details; details should depend on abstractions.

**Dependency Injection** is a *mechanism* for supplying collaborators. You can do DI without inverting anything (inject a concrete class), and you can honour DIP conceptually without a DI framework.

The "inversion" is the *direction of the source-code dependency arrow*:

```text
NAIVE (arrow points down at detail)        INVERTED (detail points up at policy)
+------------------+                       +------------------+
|  OrderService    |                       |  OrderService    |  (high-level policy)
|  (high level)    |                       +------------------+
+------------------+                                |
        | depends on                                | depends on
        v                                           v
+------------------+                       +------------------+
|  PostgresRepo    |  (low-level detail)   |  <<interface>>   |  owned by the policy layer
+------------------+                       |   OrderRepo      |
                                           +------------------+
                                                    ^
                                                    | implements (arrow now points UP)
                                           +------------------+
                                           |  PostgresRepo    |  (low-level detail)
                                           +------------------+
```

Crucially the `OrderRepo` interface *belongs to* the high-level layer (it's defined in terms of what the business logic needs), and the low-level `PostgresRepo` implements it. The database now depends on the domain, not the reverse — that's the *inversion*. DI is then how `OrderService` receives a `PostgresRepo` at runtime, but the *architectural win* is the flipped arrow, which is DIP.

### Q8. What is a DI container and when do you actually need one?

A **DI container** (Spring, Guice, Dagger, .NET's built-in `IServiceCollection`, NestJS's provider system) is a framework that *automatically* constructs your objects and injects their dependencies based on registered mappings. You declare "when someone needs `Emailer`, give them `SmtpEmailer`," and the container resolves the whole graph transitively.

```java
// Registration (config): map abstraction -> implementation + lifetime
@Configuration
class AppConfig {
    @Bean Emailer emailer() { return new SmtpEmailer(); }
    @Bean OrderRepo repo()  { return new PostgresRepo(); }
    @Bean OrderService svc(Emailer e, OrderRepo r) { return new OrderService(e, r); }
}
// The container builds the graph; you just ask for the top object.
```

**What it buys you**: it eliminates hand-wiring boilerplate in large graphs, manages object **lifetimes/scopes** (singleton, per-request, transient), and centralises configuration.

**When you actually need one**: large applications where the object graph is deep and wiring by hand in `main` becomes unwieldy, or where you need request-scoped/lifecycle-managed objects (web frameworks). **When you don't**: small apps, libraries, and CLIs — hand-wiring in a composition root is simpler, faster to trace, and has no framework magic. The trap is treating "DI" and "the container" as synonyms and reaching for Spring to inject two dependencies. Constructor injection wired manually in one `main` is DI and often the better call. A container is an *optimisation* for wiring at scale, not a prerequisite for the principle.

### Q9. What is the stable-dependencies principle?

The **Stable-Dependencies Principle (SDP)** says: *depend in the direction of stability.* A module should only depend on modules that are *more stable* (harder to change) than itself. Point your dependency arrows at things that won't move under you.

"Stability" here is structural, not "bug-free." A component is **stable** when many things depend on it and it depends on few — changing it is expensive (lots of downstream breakage), so it's *resistant* to change. It's **unstable/volatile** when it depends on many things and few depend on it — it's cheap and safe to change.

Uncle Bob's **instability metric**: `I = Ce / (Ca + Ce)`, where:
- **Ca (afferent coupling)** = number of classes *outside* the component that depend *on* it (incoming).
- **Ce (efferent coupling)** = number of classes inside that depend on things *outside* (outgoing).

`I = 0` is maximally stable (everyone depends on it, it depends on nothing); `I = 1` is maximally unstable. SDP demands that `I` *decreases* along each dependency arrow.

The violation to watch for: a stable component (many dependents) that depends on a volatile one — now the volatile thing can't change without rippling through everything above it. The fix is DIP: insert a stable *abstraction* between them, so the stable component depends on the interface (stable) and the volatile detail implements it. This is why interfaces and abstract packages sit at the "stable, abstract" corner of the design — they're the safe things to point arrows at.

### Q10. How do you actually spot bad coupling in a real codebase?

Concrete signals, roughly in order of how quickly they show up:

**Structural / static signals:**
- **Ripple in diffs** — a one-line feature change forces edits across many unrelated files (**shotgun surgery**). The version-control history is the best coupling detector you have.
- **`new ConcreteClass()` scattered everywhere** — hard-coded construction means you're coupled to concrete types; can't swap or fake them.
- **Long import lists / deep package reach-through** — a class importing from many far-flung modules has high efferent coupling.
- **Cyclic dependencies** — package A depends on B depends on A; nothing in the cycle can be understood or built alone.
- **Global/static singletons accessed everywhere** — common coupling; hidden dependencies that don't appear in signatures.

**Behavioural signals:**
- **Can't unit-test a class without standing up a database, network, or the whole app** — the tell-tale sign of tight coupling to concrete infrastructure.
- **Train wrecks** (`a.getB().getC().getD().doIt()`) — Law of Demeter violations reaching through object graphs (stamp/content coupling).
- **Flag arguments** (`doThing(order, true, false)`) — control coupling; the caller knows the callee's branches.
- **Feature envy** — a method that mostly manipulates *another* object's data belongs on that object.

**Tooling:** static-analysis tools (JDepend, SonarQube, ArchUnit, dependency-cruiser) compute afferent/efferent coupling and instability, flag cycles, and can *enforce* layering rules in CI. The pragmatic workflow: let the git history and "can I test this in isolation?" surface the hotspots, then confirm with a dependency graph and fix the worst arrows first — usually by inverting a dependency behind an interface.

### Q11. Stamp coupling vs data coupling — why prefer passing a field over the whole object?

**Stamp coupling**: a method receives a whole composite record but uses only part of it. **Data coupling**: it receives only the primitive/simple parameters it actually needs. Data coupling is looser and preferred.

```java
// STAMP coupling — greet() takes the entire User but touches one field
String greet(User user) { return "Hi " + user.getFirstName(); }
// Now greet() is coupled to the whole User type: its package, its shape, its evolution.
// You can't call greet() in a test without constructing a full valid User.

// DATA coupling — depend only on what you use
String greet(String firstName) { return "Hi " + firstName; }
// Coupled to a String. Trivially testable, reusable anywhere, indifferent to User's shape.
```

Why it matters: with stamp coupling, `greet` transitively depends on everything `User` drags in, breaks if `User` is refactored, and can't be reused outside a `User` context. Passing the field decouples it entirely.

The nuance — *don't over-apply it*. If a method genuinely uses five fields of an object and they form a **coherent concept**, passing the object (or a small **value object / parameter object**) is *better* than five loose parameters — that's cohesion, and long parameter lists are their own smell. The rule is: pass the *whole object when the method's job is about that whole concept*, pass the *field when the method only needs that value*. Stamp coupling is specifically the case of hauling a big object to reach one attribute.

### Q12. Why is a Singleton or global state a coupling problem?

A Singleton (or any global mutable state) is **common coupling** — every class that touches it is coupled to it and, transitively, to each other through it. The specific harms:

**Hidden dependencies.** A class that calls `Database.getInstance()` inside a method has a dependency that *doesn't appear in its constructor or signature*. You can't tell what a class needs by reading its API — you have to read every method body. This is the opposite of DI's explicitness.

```java
// COUPLED — dependency is invisible and un-swappable
class OrderService {
    void place(Order o) {
        Database.getInstance().save(o);      // hidden global; can't fake in a test
        EmailClient.getInstance().send(...); // another hidden global
    }
}
// DECOUPLED — dependencies explicit and injectable
class OrderService {
    OrderService(Database db, Emailer e) { ... }  // you can see and substitute them
}
```

**Untestability.** You can't substitute a fake for a `getInstance()` global, so tests need the real thing (real DB, real network) or brittle static mocking. **Concurrency hazards.** Global mutable state shared across threads invites race conditions. **Temporal coupling & lifecycle chaos.** Initialization order becomes load-bearing and hard to reason about.

The point interviewers want: *Singleton the object (one instance) is fine; Singleton the global access point is the problem.* Keep "there's one of these" as a lifecycle decision (the container makes it a singleton-scoped bean) but still *inject* it — so the dependency stays explicit, swappable, and testable. That's why Singleton is widely called an anti-pattern: it's really a globally-accessible variable wearing an OO costume.

### Q13. What's the difference between afferent and efferent coupling, and what do they tell you?

Two directional counts for a component (package/module/class):

- **Afferent coupling (Ca)** — *incoming*. The number of external classes that depend *on* this component. "How many things would break if I change this?" High Ca = **responsibility/importance**; many things rely on you.
- **Efferent coupling (Ce)** — *outgoing*. The number of external classes this component depends *on*. "How many things can break *me*?" High Ce = **dependence/fragility**; you're at the mercy of many others.

```text
        (Ca = 3 depend on it)              A ---+
          A   B   C                              +--> [ Component X ] --+--> P   (Ce = 2
           \  |  /                                                       +--> Q    it depends on)
            v v v
        [ Component X ]
            |   |
            v   v
            P   Q   (Ce = 2)
```

Combined they give **instability** `I = Ce / (Ca + Ce)` (0 = rock-stable, 1 = maximally volatile). The design guidance:

- **High Ca + low Ce (stable):** interfaces, core abstractions, widely-used utilities. These *should* be stable and abstract — many depend on them, so they must not churn. Point arrows *at* these.
- **Low Ca + high Ce (unstable):** application-specific glue, `main`, top-level orchestration. Fine to be volatile — few depend on them.
- **The danger zone — high Ca AND high Ce:** something important that's also fragile; a change to its many dependencies ripples out to its many dependents. Break it up or shield it behind abstractions.

Pair instability with **abstractness** (ratio of abstract types) and you get Martin's "main sequence": stable things should be abstract, unstable things concrete; being stable-and-concrete (the "zone of pain") or unstable-and-abstract (the "zone of uselessness") are the smells the metric surfaces.

### Q14. Constructor injection vs setter injection — which and why?

**Default to constructor injection.** Reach for setter injection only for genuinely optional or runtime-reconfigurable dependencies.

| | Constructor injection | Setter injection |
|---|---|---|
| Dependency is | Mandatory | Optional |
| Fields can be | `final` (immutable, thread-safe) | Mutable |
| Object validity | Fully-formed once constructed | Can exist half-configured |
| Reveals over-injection | Yes — big constructor = a smell you can *see* | No — smell is hidden across setters |
| Circular deps | Fails fast (can't construct) | Silently allows them |

```java
// CONSTRUCTOR — invariant: you cannot create an invalid OrderService
class OrderService {
    private final OrderRepo repo;
    private final Emailer emailer;
    OrderService(OrderRepo repo, Emailer emailer) {
        this.repo = Objects.requireNonNull(repo);
        this.emailer = Objects.requireNonNull(emailer);
    }
}
// SETTER — legitimate for optional collaborators with a sane default
class OrderService {
    private Metrics metrics = Metrics.NOOP;   // works without it
    void setMetrics(Metrics m) { this.metrics = m; }  // opt-in
}
```

Constructor injection's biggest hidden benefit is **honesty**: a constructor with eight parameters is *shouting* that the class has too many responsibilities (low cohesion). Setter injection lets that same class hide its bloat behind eight setters. So constructor injection isn't just safer — it keeps design pressure visible. The main historical argument for setters (breaking constructor cycles) is better answered by *removing the cycle*, which is a design flaw the constructor approach usefully forces you to confront.

### Q15. Walk through refactoring a tightly-coupled class to be testable with DI.

Start with a class welded to concrete infrastructure — untestable without a real database and SMTP server:

```java
// BEFORE — tightly coupled, hidden dependencies, untestable
class SignupService {
    void register(String email) {
        var user = new User(email);
        new PostgresUserRepo().save(user);          // hard-coded concrete DB
        new SmtpMailer().send(email, "Welcome!");   // hard-coded concrete mailer
        Analytics.getInstance().track("signup");    // hidden global singleton
    }
}
```

Three coupling problems: `new` on concrete classes (can't swap), a global singleton (hidden, un-fakeable). The refactor, in small safe steps:

**1. Extract abstractions (program to an interface).** Define the narrow contracts the service actually needs:

```java
interface UserRepo   { void save(User u); }
interface Mailer     { void send(String to, String body); }
interface Analytics  { void track(String event); }
```

**2. Inject them via the constructor (DI + DIP).** The service now depends on abstractions, supplied from outside:

```java
class SignupService {
    private final UserRepo repo;
    private final Mailer mailer;
    private final Analytics analytics;
    SignupService(UserRepo repo, Mailer mailer, Analytics analytics) {
        this.repo = repo; this.mailer = mailer; this.analytics = analytics;
    }
    void register(String email) {
        var user = new User(email);
        repo.save(user);
        mailer.send(email, "Welcome!");
        analytics.track("signup");
    }
}
```

**3. Wire concretes at the composition root** (`main` or the DI container) — the *only* place that knows the concrete types:

```java
new SignupService(new PostgresUserRepo(), new SmtpMailer(), new StatsdAnalytics());
```

**4. Now the test is trivial** — inject fakes/mocks, assert on behaviour, no infrastructure:

```java
@Test void register_savesUserAndSendsWelcome() {
    var repo = new InMemoryUserRepo();
    var mailer = new FakeMailer();
    var svc = new SignupService(repo, mailer, event -> {});   // lambda impl of Analytics
    svc.register("alice@acme.test");
    assertTrue(repo.contains("alice@acme.test"));
    assertEquals("Welcome!", mailer.lastBodyTo("alice@acme.test"));
}
```

The dependency arrows now point at interfaces the service owns; the database and mailer implement *its* contracts (DIP), and every concrete choice lives in one swappable place. Testability was the *symptom*; inverted, explicit dependencies are the cure.

## Creational Patterns I: Factory & Builder

### Summary

**What this topic covers**

The GoF creational patterns that answer "how should this object get *made*?" — specifically the factory family (**Simple Factory** idiom, **Factory Method**, **Abstract Factory**) and the **Builder**. (Singleton and Prototype are the next topic.) Creational patterns exist because the naive answer — scatter `new ConcreteClass()` across the codebase — couples every caller to concrete types and to construction details, violating both "program to an interface" and Open/Closed. Four concern areas: (1) the **problem** creational patterns solve; (2) the **factory ladder** — from the simple-factory idiom up through Factory Method (defer *which subclass* to subclasses) to Abstract Factory (create *families* of related products); (3) **Builder** — taming complex, multi-step, or optional-heavy construction with a fluent API; and (4) the sharp **comparisons** — Factory Method vs Abstract Factory, Builder vs Factory. The 15 questions cover each pattern's intent, UML, minimal code, real use, and — critically — *when not to reach for it*.

**Mental model**

Every creational pattern is one move: **take the decision of what to construct, and where/how, and put it behind a stable seam so callers don't hard-code concrete classes.** They differ only in *what* they abstract. Simple Factory abstracts *a single choice* ("give me a shape for this string") behind one method. Factory Method abstracts *which subclass instantiates the product*, deferring it via inheritance/polymorphism (the base defines the workflow, subclasses decide the concrete product). Abstract Factory abstracts *a whole family* of products that must be used together and stay consistent (all-Windows widgets or all-Mac widgets, never mixed). Builder abstracts *the assembly process* of one complex object — many optional parts, step-by-step, validated at `build()`. When you feel construction pain, ask: *what varies?* One product by a tag → Simple Factory. Which subclass → Factory Method. A consistent family → Abstract Factory. A complex single object with many knobs → Builder. Same meta-principle as everywhere: encapsulate what varies — here, the varying thing is *creation itself*.

**Key terms**

- **Creational pattern** — a pattern that abstracts the instantiation process, decoupling clients from concrete classes.
- **Simple Factory** — an idiom (not an official GoF pattern): a method/class that returns a concrete type chosen by a parameter.
- **Factory Method** — define an interface for creating an object but let *subclasses* decide which class to instantiate.
- **Abstract Factory** — provide an interface for creating *families* of related objects without specifying concretes.
- **Builder** — separate the construction of a complex object from its representation so the same process builds different results.
- **Product** — the object a factory creates.
- **Fluent interface** — method chaining (`.setX().setY()`) that returns the builder for readable step-by-step construction.
- **Telescoping constructor** — the anti-pattern of many overloaded constructors for optional params; Builder's motivating problem.
- **Family of products** — a set of objects meant to be used together and kept consistent (Abstract Factory's domain).
- **Director** (Builder) — optional class that encodes a fixed construction *sequence* using a builder.

**Why interviewers ask this**

Creational patterns are the most-abused corner of the pattern catalogue — the "golden hammer" zone. The junior signal is reaching for a factory reflexively (a factory that only ever makes one class; an Abstract Factory for a single product). The senior signal is *restraint plus discrimination*: knowing that a plain constructor is usually right, that Simple Factory covers most real needs, and being able to *precisely distinguish* Factory Method from Abstract Factory (inheritance-of-one-product vs composition-of-a-family) and Builder from Factory (step-by-step assembly vs one-shot selection). Interviewers also probe the *why*: what coupling does this remove, and what does it cost (indirection, more classes)? A candidate who can say "I'd use a Builder here because there are eight optional fields and I want immutability, but a factory would be overkill" is demonstrating judgement, not memorisation.

**Common confusions**

- "Factory Method and Abstract Factory are the same" — Factory Method makes *one* product via inheritance (override a method); Abstract Factory makes a *family* of products via composition (an object with several create-methods).
- "Simple Factory is a GoF pattern" — it isn't; it's a useful idiom. GoF's Factory Method is the inheritance-based one.
- "Builder is for object creation like a factory" — a factory *chooses/returns* a type in one call; a Builder *assembles* one complex object step-by-step. Different problems.
- "Use a factory to avoid `new`" — you can't avoid `new`; a factory *centralises* it so callers don't depend on concretes. Somewhere still calls `new`.
- "Builder is only for immutability" — immutability is a common motivation, but Builder's core purpose is taming complex/optional-heavy construction (killing telescoping constructors).

**What follows from this topic**

These patterns are **program-to-an-interface** and **Open/Closed** made concrete for the specific act of construction — the payoff of the dependency discussion in the previous topic (a factory is often *how* you keep `new ConcreteClass()` out of your high-level code). The next topic covers the remaining creational patterns (**Singleton**, **Prototype**, Object Pool). Downstream, the structural and behavioural patterns frequently *rely* on a factory to instantiate their varying parts — a Strategy is often chosen by a factory, an Abstract Factory hands back a family of Bridge implementors. Creation is the seam; these patterns are how you keep it clean.

### Q1. What problem do creational patterns solve?

The naive way to make objects — `new ConcreteClass(...)` wherever you need one — has three compounding problems:

**1. Coupling to concrete types.** Every caller that writes `new PostgresRepo()` is hard-bound to that class. To swap it (for MySQL, for a fake in tests) you must edit every call site. This directly violates "program to an interface, not an implementation."

**2. Construction logic gets duplicated and scattered.** If building the object requires configuration, validation, or choosing among variants, that logic is copy-pasted at every `new`. Change the rule and you have shotgun surgery.

**3. Open/Closed violation.** Adding a new variant means finding and editing existing code (the `if type == "A"` chains), rather than adding a class.

```java
// BEFORE — the client is coupled to every concrete Shape and owns the choice logic
Shape s;
if (type.equals("circle"))      s = new Circle();
else if (type.equals("square")) s = new Square();
else if (type.equals("hex"))    s = new Hexagon();   // adding a shape edits THIS code
```

Creational patterns fix this by **encapsulating the "what to create" and "how to create it" decisions behind a stable interface**, so:
- Callers depend on an abstraction (`Shape`), not concretes.
- Construction logic lives in one place.
- New variants are added by writing a new class + one registration, not by editing callers (Open/Closed).

They don't *eliminate* `new` — something, somewhere still constructs the object — they *centralise* it so the coupling exists in exactly one swappable spot instead of smeared across the code.

### Q2. What is the Simple Factory idiom?

**Simple Factory** (a.k.a. Static Factory) is not one of the 23 GoF patterns — it's the humble, widely-used idiom you reach for first: a single method (often static) that takes a parameter and returns the appropriate concrete product, hidden behind a shared interface.

**Intent:** centralise the "which concrete class?" decision in one place so callers just ask for a product by tag.

```text
+--------+   asks    +---------------+   creates   +----------+
| Client |---------->| ShapeFactory  |------------>|  Circle  |
+--------+           | create(type)  |             |  Square  |  (all implement Shape)
                     +---------------+             |  Hexagon |
                                                   +----------+
```

```java
interface Shape { void draw(); }

class ShapeFactory {
    static Shape create(String type) {
        return switch (type) {
            case "circle" -> new Circle();
            case "square" -> new Square();
            case "hex"    -> new Hexagon();
            default -> throw new IllegalArgumentException("unknown: " + type);
        };
    }
}
// Client is now decoupled from concrete shapes:
Shape s = ShapeFactory.create("circle");
```

**Real use:** parsing (`ShapeFactory.create(tag)`), `java.util.Calendar.getInstance()`, `NumberFormat.getInstance(locale)` — these are all simple factories.

**When it's enough / when not:** Simple Factory handles the vast majority of real "I need to pick a concrete class" situations and is often *all* you need — don't over-promote it to Factory Method or Abstract Factory without cause. Its limitation is Open/Closed: adding a product edits the `switch`. If that switch is churning constantly and you want to add variants *without touching the factory*, that's the trigger to graduate to Factory Method (polymorphic) or a registry.

### Q3. Explain the Factory Method pattern with UML and code.

**Intent (GoF):** "Define an interface for creating an object, but let subclasses decide which class to instantiate. Factory Method lets a class defer instantiation to subclasses."

The mechanism is **inheritance**: a base class contains the workflow and calls an abstract `createProduct()`; each subclass overrides it to produce its concrete product. The base is *closed* to modification but *open* to new subclasses.

```text
+---------------------+          +-------------+
|     Creator         |          |  Product    |  (interface)
|---------------------|          +-------------+
| + someOperation()   |               ^
| + createProduct()   | - - - - - - -/ \ - - - creates
+---------------------+              <|.. 
        ^                        ConcreteProductA / B
        | <|-- (subclasses override createProduct)
+---------------------+
| ConcreteCreatorA    |  createProduct() { return new ConcreteProductA(); }
| ConcreteCreatorB    |  createProduct() { return new ConcreteProductB(); }
+---------------------+
```

```java
abstract class Dialog {                       // Creator
    void render() {                           // the workflow, shared by all subclasses
        Button ok = createButton();           // <-- the Factory Method
        ok.onClick(this::close);
        ok.paint();
    }
    abstract Button createButton();           // subclasses decide the concrete Button
}
class WindowsDialog extends Dialog {
    Button createButton() { return new WindowsButton(); }
}
class WebDialog extends Dialog {
    Button createButton() { return new HtmlButton(); }
}
// Client picks a Creator; the rest of the workflow is identical & reused.
Dialog dialog = onWindows ? new WindowsDialog() : new WebDialog();
dialog.render();
```

**Real use:** framework "template" methods that create the varying piece — `Collection.iterator()` (each collection returns its own `Iterator`), JDBC `Connection` creating `Statement`s, document frameworks where `Application.createDocument()` is overridden per app.

**When NOT to use:** if you're not already subclassing for other reasons, introducing an inheritance hierarchy *just* to pick a class is heavier than a Simple Factory or DI. Factory Method earns its keep when a base class has a real algorithm and only the *product type* varies per subclass.

### Q4. Explain the Abstract Factory pattern.

**Intent (GoF):** "Provide an interface for creating *families of related or dependent objects* without specifying their concrete classes."

The key word is **family**: several products that must be used together and kept mutually consistent. An Abstract Factory is an *object* (chosen via composition, injected in) exposing several `create` methods — one per product in the family — so that picking one factory guarantees a consistent set.

```text
+----------------------+        creates      +----------+   +-----------+
|  <<GUIFactory>>      |------------------->  |  Button  |   | Checkbox  |  (product interfaces)
|  createButton()      |                      +----------+   +-----------+
|  createCheckbox()    |                          ^               ^
+----------------------+                          |               |
        ^        ^                         WinButton/MacButton  WinCheckbox/MacCheckbox
        |        |
+-------------+  +--------------+
| WinFactory  |  | MacFactory   |   each returns a CONSISTENT family (all-Win or all-Mac)
+-------------+  +--------------+
```

```java
interface GUIFactory {
    Button   createButton();
    Checkbox createCheckbox();
}
class WinFactory implements GUIFactory {
    public Button   createButton()   { return new WinButton(); }
    public Checkbox createCheckbox() { return new WinCheckbox(); }
}
class MacFactory implements GUIFactory {
    public Button   createButton()   { return new MacButton(); }
    public Checkbox createCheckbox() { return new MacCheckbox(); }
}
// Client is handed ONE factory and gets a guaranteed-consistent family:
class App {
    App(GUIFactory factory) {                 // injected — client never names a concrete
        Button b = factory.createButton();
        Checkbox c = factory.createCheckbox();  // guaranteed to match b's look & feel
    }
}
new App(onMac ? new MacFactory() : new WinFactory());
```

**Real use:** cross-platform UI toolkits (all widgets match one OS), pluggable persistence (a `DbFactory` yielding matching `Connection`/`Command`/`Transaction`), theming (a `DarkThemeFactory` producing a coordinated set of components).

**When NOT to use:** if you only have *one* product (not a family), you don't need it — use Factory Method or Simple Factory. And Abstract Factory is rigid about *adding a new product type*: adding a `createSlider()` means editing the interface and every factory (an Open/Closed cost). It shines when *families vary* but the *set of product types is stable*.

### Q5. Factory Method vs Abstract Factory — what's the real difference?

They're constantly confused. The crisp distinctions:

| | Factory Method | Abstract Factory |
|---|---|---|
| **Creates** | *One* product | A *family* of related products |
| **Mechanism** | **Inheritance** — override a method in a subclass | **Composition** — hold a factory object with several create-methods |
| **Varies via** | Subclassing the creator | Swapping the whole factory instance |
| **Structure** | A method | An object (often *containing* several factory methods) |
| **Adds a new product easily?** | N/A (one product) | No — must change the interface + all factories |
| **Adds a new family/variant easily?** | Yes — new subclass | Yes — new factory implementation |

The mental picture: **Factory Method is one method that returns one product, resolved by which subclass you're in. Abstract Factory is one object that returns a whole coordinated set, resolved by which factory you hold.** In fact Abstract Factory implementations are frequently *built out of* Factory Methods — each `createXxx()` on the concrete factory is itself a factory method.

```java
// Factory Method: choose the product by SUBCLASS (inheritance)
abstract class Logistics { abstract Transport createTransport(); }  // one product
class RoadLogistics extends Logistics { Transport createTransport(){ return new Truck(); } }

// Abstract Factory: choose the FAMILY by which factory you hold (composition)
interface FurnitureFactory { Chair createChair(); Sofa createSofa(); } // a family
class VictorianFactory implements FurnitureFactory { /* matching Chair + Sofa */ }
```

Rule of thumb: **one product varying by subtype → Factory Method; several products that must stay consistent as a set → Abstract Factory.**

### Q6. What is the Builder pattern and what problem does it solve?

**Intent (GoF):** "Separate the construction of a complex object from its representation, so that the same construction process can create different representations."

The motivating problem is **complex construction**: an object with many parameters, several of them optional, and possibly validation or multi-step assembly. Doing that through constructors leads to the **telescoping constructor** anti-pattern (see next question) or a mutable object with a dozen setters that can be left half-built.

Builder gives you a separate object that accumulates the parts via a **fluent interface**, then produces the finished (often immutable) product in one `build()` call — where validation of the whole happens.

```text
+----------+   step by step   +----------------+   build()   +---------+
| Client   |---------------->| PizzaBuilder    |----------->|  Pizza  |  (immutable product)
+----------+                 | size(..)        |            +---------+
                             | cheese(..)      |
                             | topping(..)     |  returns `this` for chaining
                             | build(): Pizza  |
                             +----------------+
```

```java
Pizza p = new Pizza.Builder()
        .size(Size.LARGE)          // required
        .cheese(true)              // optional, in any order
        .addTopping("mushroom")
        .addTopping("olives")
        .build();                  // validates & produces immutable Pizza
```

**Real use:** `StringBuilder`, Java's `Stream.Builder`, `HttpRequest.newBuilder()...build()`, Lombok's `@Builder`, protobuf message builders, `AlertDialog.Builder` on Android — all Builders.

**When it pays off:** roughly 4+ constructor parameters, several optional, or where you want an immutable result and readable call sites. **When NOT to:** an object with two or three required fields — a plain constructor (or a small factory) is simpler; a Builder there is ceremony for its own sake.

### Q7. Show the telescoping-constructor problem and how Builder fixes it.

The **telescoping constructor** anti-pattern appears when a class has optional parameters and you provide an overload for every combination:

```java
// BEFORE — telescoping constructors: unreadable, error-prone, combinatorial
class NutritionFacts {
    NutritionFacts(int servingSize, int servings) {...}
    NutritionFacts(int servingSize, int servings, int calories) {...}
    NutritionFacts(int servingSize, int servings, int calories, int fat) {...}
    NutritionFacts(int servingSize, int servings, int calories, int fat, int sodium) {...}
    // ...and the call site is a wall of unlabeled numbers:
}
var cola = new NutritionFacts(240, 8, 100, 0, 35, 27);  // which 0 is fat? which is sodium??
```

Two failures: you can't tell what each argument *means* at the call site, and every optional field forces more overloads (or passing `0`/`null` placeholders). A "JavaBeans" alternative (no-arg constructor + setters) fixes readability but leaves the object **mutable and constructable in an invalid, half-set state** — and not thread-safe.

**Builder fixes both** — named steps, any order, only what you want, immutable result validated at the end:

```java
// AFTER — Builder: self-documenting, optional-friendly, immutable, validated
class NutritionFacts {
    private final int servingSize, servings, calories, fat, sodium;
    private NutritionFacts(Builder b) {            // private ctor; only Builder calls it
        servingSize = b.servingSize; servings = b.servings;
        calories = b.calories; fat = b.fat; sodium = b.sodium;
    }
    static class Builder {
        private final int servingSize, servings;   // required -> Builder constructor
        private int calories = 0, fat = 0, sodium = 0; // optional -> sane defaults
        Builder(int servingSize, int servings) { this.servingSize = servingSize; this.servings = servings; }
        Builder calories(int v) { calories = v; return this; }  // return this = fluent
        Builder fat(int v)      { fat = v;      return this; }
        Builder sodium(int v)   { sodium = v;   return this; }
        NutritionFacts build() {
            if (calories < 0) throw new IllegalArgumentException("calories < 0"); // validate the whole
            return new NutritionFacts(this);
        }
    }
}
var cola = new NutritionFacts.Builder(240, 8)   // required, explicit
        .calories(100).sodium(35).build();       // optional, named, immutable result
```

The call site now reads like labelled prose, invalid combinations are caught in `build()`, and the finished object is immutable (thread-safe by construction). This is the textbook Effective Java "consider a builder when faced with many constructor parameters" case.

### Q8. Builder vs Factory — when do you use which?

They solve *different* problems and are not interchangeable:

| | Factory (Method / Abstract / Simple) | Builder |
|---|---|---|
| **Answers** | *Which* concrete type do I make? | *How* do I assemble this one complex object? |
| **Call shape** | One call returns a product | Many chained calls, then `build()` |
| **Focus** | Polymorphic *selection* among types | Step-by-step *construction* of parts |
| **Product** | Usually one of several subtypes | Usually one type with many configurations |
| **Motivating pain** | Coupling to concrete classes | Too many (optional) constructor params |

**Use a Factory** when the variation is *which class* — you want a `Shape`, a `PaymentGateway`, a platform-appropriate `Button`, and the caller shouldn't name the concrete type.

**Use a Builder** when the variation is *how one object is configured* — many parameters, optional fields, you want readability and immutability. There's only one product type; the complexity is in assembling it.

```java
// Factory: "give me the right kind of thing"
Notifier n = NotifierFactory.forChannel(Channel.SMS);   // selection

// Builder: "assemble this one intricate thing"
HttpRequest req = HttpRequest.newBuilder()              // construction
        .uri(URI.create("https://acme.test"))
        .header("Accept", "application/json")
        .timeout(Duration.ofSeconds(5))
        .GET()
        .build();
```

They **compose** happily: a factory can *return a builder*, or a builder's `build()` can *use a factory* internally to pick a sub-part. Rule of thumb: *type* varies → Factory; *configuration* varies → Builder.

### Q9. When should you NOT use a factory? What's the over-engineering trap?

Factories are the most over-applied creational tool ("golden hammer"). Skip them when:

**1. There's only ever one implementation.** A `UserFactory` that only ever does `return new User(...)` adds indirection for zero benefit. Just call the constructor. A factory earns its place when there's *real* polymorphism or *real* construction complexity to hide.

**2. A plain constructor or static factory method is clearer.** For "make me a `Point(x, y)`," `new Point(2, 3)` beats `PointFactory.create(2, 3)`. If you want a *named* constructor (`Point.polar(r, θ)` vs `Point.cartesian(x, y)`) a **static factory method** on the class itself is the lightweight answer — no separate factory class.

**3. DI already solves your coupling.** If a DI container injects the right implementation, you often don't need a hand-rolled factory at all — the container *is* your factory. Introduce an explicit factory mainly when creation is *dynamic* (the type depends on runtime data) or *repeated* (you make many, not one wired-once instance).

**4. YAGNI on speculative variation.** Building an `AbstractWidgetFactory` because "we might support another platform someday" with no second platform in sight is textbook premature abstraction.

The tell of over-engineering: factories that only make one thing, factory factories, or an Abstract Factory wrapping a single product. The honest default is **a plain constructor**; graduate to a Simple Factory when a *real* second variant appears, and only climb to Factory Method / Abstract Factory when the variation is genuinely about subclass workflow or product families. Restraint reads as senior; reflexive pattern-stamping reads as junior.

### Q10. How would you make a factory Open/Closed — adding a product without editing the factory?

A plain Simple Factory's weakness is its `switch`: adding a product means editing the factory (violating Open/Closed). The fix is a **registry** — the factory looks up a *registered* creator instead of hard-coding the branches, so new products *register themselves* without touching the factory.

```java
// Registry-based factory: closed for modification, open for new products
class ShapeFactory {
    private static final Map<String, Supplier<Shape>> registry = new HashMap<>();

    static void register(String key, Supplier<Shape> creator) { registry.put(key, creator); }

    static Shape create(String key) {
        var creator = registry.get(key);
        if (creator == null) throw new IllegalArgumentException("unknown shape: " + key);
        return creator.get();
    }
}

// A NEW shape adds itself — the factory code is never touched:
class Hexagon implements Shape {
    static { ShapeFactory.register("hex", Hexagon::new); }   // self-registration
    public void draw() {...}
}
```

Now adding `Pentagon` means writing the `Pentagon` class and registering it (or wiring it in a config/DI module) — the factory's own code stays closed. Common realisations:

- **Explicit registration map** (above) — populated at startup or via DI configuration.
- **Service loader / plugin discovery** — Java's `ServiceLoader`, so dropping a JAR on the classpath adds a product with *no* code change at all.
- **Reflection/annotation scanning** — a framework discovers `@Component`-annotated products.

Trade-off: registries add a layer of indirection and lose the compile-time exhaustiveness a `switch` on a sealed type gives you (you can't statically prove every case is handled). So reach for a registry when you genuinely need *extensibility without modification* (plugins, third-party products); for a small, closed, known set of types, a `switch` over a sealed/enum type is simpler and safer. Match the machinery to whether the product set is truly open.

### Q11. Give a real end-to-end example where Abstract Factory is the right call.

**Scenario:** a reporting tool must export to multiple *coordinated* formats. A PDF export needs a PDF header, PDF table, and PDF chart; an HTML export needs the HTML versions — and you must **never mix** a PDF table into an HTML document. That "must stay consistent as a family" requirement is exactly Abstract Factory's sweet spot.

```java
// Product interfaces (the family)
interface Header { String render(String title); }
interface Table  { String render(List<Row> rows); }
interface Chart  { String render(Series data); }

// Abstract factory — one create-method per product in the family
interface ReportFactory {
    Header header();
    Table  table();
    Chart  chart();
}

// Concrete families — each yields a fully-consistent set
class PdfReportFactory implements ReportFactory {
    public Header header() { return new PdfHeader(); }
    public Table  table()  { return new PdfTable(); }
    public Chart  chart()  { return new PdfChart(); }
}
class HtmlReportFactory implements ReportFactory {
    public Header header() { return new HtmlHeader(); }
    public Table  table()  { return new HtmlTable(); }
    public Chart  chart()  { return new HtmlChart(); }
}

// Client works only against abstractions; the family can't be mixed
class ReportBuilder {
    private final ReportFactory f;
    ReportBuilder(ReportFactory f) { this.f = f; }   // inject ONE family
    String build(Doc doc) {
        return f.header().render(doc.title())
             + f.table().render(doc.rows())
             + f.chart().render(doc.series());        // all guaranteed same format
    }
}
// Choose the family once, at the edge:
var report = new ReportBuilder(userWantsPdf ? new PdfReportFactory() : new HtmlReportFactory())
        .build(doc);
```

**Why Abstract Factory and not the alternatives:** there are *multiple* products (`Header`, `Table`, `Chart`) that must be *mutually consistent* — that rules out Simple Factory / Factory Method (which each hand back *one* product with no consistency guarantee across the set). Selecting the factory once makes an entire mismatched-format bug class *impossible by construction*. Adding a new *format* (Markdown) is easy — one new factory. The cost you accept: adding a new *product type* (`Footer`) touches the interface and every factory — acceptable here because formats grow but the product set is stable.

### Q12. What is a Director in the Builder pattern, and do you need one?

In GoF's original Builder, the **Director** is a separate class that knows the *sequence* of build steps for a particular configuration; the Builder knows *how* to perform each step. The client hands the Director a builder, the Director drives the recipe, and the builder produces the product. It separates "the construction algorithm" (Director) from "the construction of parts" (Builder).

```java
class Car { /* ... */ }

interface CarBuilder {                 // knows HOW to make each part
    void reset();
    void setSeats(int n);
    void setEngine(Engine e);
    void setGps(boolean on);
    Car getResult();
}

class Director {                       // knows the RECIPE / sequence
    Car buildSportsCar(CarBuilder b) {
        b.reset();
        b.setSeats(2);
        b.setEngine(new V8());
        b.setGps(true);
        return b.getResult();
    }
    Car buildCityCar(CarBuilder b) {
        b.reset(); b.setSeats(4); b.setEngine(new Electric()); b.setGps(false);
        return b.getResult();
    }
}
```

The Director's value is when you have **several fixed, reusable construction recipes** you want to name and not duplicate — `buildSportsCar` vs `buildCityCar`. It centralises those sequences.

**Do you need one? Usually no.** In practice — and especially in the popular *fluent Builder* (Effective Java) style — the client *is* the director: it just chains the steps it wants. The separate Director class only pays off when (a) the same construction sequence is reused in many places (so you don't repeat the recipe), or (b) you want to build the *same* product different ways via *different* builders driven by one algorithm. For the common "object with many optional fields" case, skip the Director — the fluent builder alone is the right, lighter tool.

### Q13. How do you implement a fluent Builder in Python or TypeScript?

The pattern is language-agnostic; the idioms differ. Each language also has *lighter* alternatives worth knowing.

**Python** — return `self` from each setter; validate in `build()`:

```python
class PizzaBuilder:
    def __init__(self, size):
        self._size = size            # required
        self._cheese = False
        self._toppings = []
    def cheese(self, on=True):
        self._cheese = on
        return self                  # fluent
    def add_topping(self, t):
        self._toppings.append(t)
        return self
    def build(self):
        if self._size not in ("S", "M", "L"):
            raise ValueError("bad size")
        return Pizza(self._size, self._cheese, tuple(self._toppings))

pizza = PizzaBuilder("L").cheese().add_topping("mushroom").build()
```

But in Python, a Builder is often *unnecessary*: **keyword arguments with defaults** and `@dataclass` cover most "many optional params" cases far more simply:

```python
from dataclasses import dataclass, field
@dataclass(frozen=True)                       # frozen = immutable, like build() result
class Pizza:
    size: str
    cheese: bool = False
    toppings: tuple = ()
Pizza(size="L", cheese=True, toppings=("mushroom",))   # kwargs = named, optional, no Builder
```

**TypeScript** — chain methods returning `this`, or prefer an options object:

```typescript
class RequestBuilder {
  private url = "";
  private headers: Record<string, string> = {};
  setUrl(u: string): this { this.url = u; return this; }
  header(k: string, v: string): this { this.headers[k] = v; return this; }
  build(): Request { if (!this.url) throw new Error("url required"); return new Request(this.url, this.headers); }
}
const req = new RequestBuilder().setUrl("https://acme.test").header("Accept", "json").build();

// Lighter TS idiom for optional config: an options object with a Partial/defaults merge
function makeRequest(opts: { url: string; headers?: Record<string,string>; timeoutMs?: number }) { ... }
```

The takeaway for an interview: know the classic fluent Builder, but *also* know that Python kwargs/dataclasses and TS options objects often make a full Builder redundant. Reach for the real Builder when you need enforced immutability, step-by-step validation, or a genuinely complex multi-part assembly — otherwise the language's native named-argument mechanism is the KISS answer.

### Q14. A caller does `new PaymentProcessor("stripe")` and the constructor switches on the string. Refactor it.

The smell: a constructor doing type-dispatch on a string is a **Simple Factory hiding inside a constructor** — it couples `PaymentProcessor` to every concrete gateway and violates Open/Closed (a new gateway edits the constructor).

```java
// BEFORE — construction logic + polymorphism smashed into one class
class PaymentProcessor {
    private Gateway gateway;
    PaymentProcessor(String kind) {
        if (kind.equals("stripe"))      gateway = new StripeGateway();
        else if (kind.equals("paypal")) gateway = new PayPalGateway();
        else throw new IllegalArgumentException(kind);
    }
    void charge(Money m) { gateway.charge(m); }
}
```

**Refactor 1 — extract a factory + program to an interface (and inject).** Pull the selection into a factory; let `PaymentProcessor` depend on the `Gateway` abstraction, supplied via DI:

```java
interface Gateway { void charge(Money m); }

class GatewayFactory {
    private static final Map<String, Supplier<Gateway>> reg = Map.of(
        "stripe", StripeGateway::new,
        "paypal", PayPalGateway::new);
    static Gateway create(String kind) {
        var s = reg.get(kind);
        if (s == null) throw new IllegalArgumentException("unknown gateway: " + kind);
        return s.get();
    }
}

class PaymentProcessor {
    private final Gateway gateway;
    PaymentProcessor(Gateway gateway) { this.gateway = gateway; }  // DI: no string, no switch
    void charge(Money m) { gateway.charge(m); }
}

// Composition root wires it:
var processor = new PaymentProcessor(GatewayFactory.create(config.gateway()));
```

Now `PaymentProcessor` is decoupled from concrete gateways and trivially testable (inject a `FakeGateway`). The string-to-type decision lives in exactly one place — the factory — and with the registry map, a new gateway registers itself without editing existing code (Open/Closed). If the gateway is wired once at startup, a **DI container** can replace the hand-rolled factory entirely; keep the explicit factory when the choice is *runtime-dynamic* (per-request, per-tenant). Either way, the fix is the same principle: separate *choosing* the implementation from *using* it.

### Q15. Compare the whole factory family: Simple Factory vs Factory Method vs Abstract Factory. When each?

The three sit on a ladder of increasing power and cost. Climb only as far as the variation actually demands.

| | Simple Factory (idiom) | Factory Method (GoF) | Abstract Factory (GoF) |
|---|---|---|---|
| **Creates** | One product, chosen by param | One product, chosen by subclass | A *family* of related products |
| **Mechanism** | A method with a `switch`/map | Inheritance — override a method | Composition — an object of create-methods |
| **Open/Closed?** | No (edit the switch) — unless registry | Yes — add a subclass | New family: yes; new product type: no |
| **Weight** | Lightest | Medium (needs a hierarchy) | Heaviest (interface + N factories) |
| **Use when** | You just need to hide "which concrete class" | A base class has a workflow and only the product varies per subclass | Multiple products must stay mutually consistent |

**Decision flow:**

1. **Do I even have polymorphism / construction complexity?** No → just use a constructor (or a static factory method for a nicer name). Don't build a factory.
2. **One product, choice driven by a tag/parameter?** → **Simple Factory** (add a registry if you need Open/Closed extensibility).
3. **One product, but the choice naturally belongs to a subclass that already owns a workflow?** → **Factory Method** (e.g. a framework base class whose subclasses supply the concrete piece).
4. **Several products that must be created as a consistent set / family?** → **Abstract Factory**.

The senior framing: these aren't ranked by prestige — they're ranked by *how much variation you're absorbing*. Most real code needs only a constructor or a Simple Factory. Factory Method appears where frameworks already use inheritance. Abstract Factory is reserved for the genuine "family consistency" problem, and it's the one most often installed prematurely. Pick the *lowest* rung that covers the variation you actually have — that restraint is the whole skill.
## Creational Patterns II: Singleton, Prototype & Object Pool

### Summary

**What this topic covers**

The creational patterns that are less about *hiding a constructor behind a factory* and more about *controlling the lifecycle and identity of instances*. Three patterns live here plus one important idiom: (1) **Singleton** — guaranteeing exactly one instance and a global access point, its implementations (eager, lazy, holder, enum), how to make it thread-safe (double-checked locking), and — the part interviewers actually care about — **why it is so often an anti-pattern** (hidden global state, untestability, hidden coupling); (2) **Prototype** — creating new objects by *cloning* an existing configured instance instead of calling a constructor, and the deep-vs-shallow-copy minefield that comes with it; (3) **Object Pool** — reusing a fixed set of expensive-to-create objects (connections, threads, buffers) instead of allocating and destroying them; and the **registry** idiom that frequently pairs with Prototype and Singleton. The 16 questions move from "write a thread-safe singleton" to "here is a Singleton-riddled codebase, refactor it" and "when is Object Pool premature optimization?"

**Mental model**

These patterns answer *"how many, and where do they come from?"* — not *"which concrete class?"* (that is Factory Method / Abstract Factory). Singleton says **one, forever, reachable globally** — powerful and dangerous because global reachability is the same thing as global coupling. Prototype says **copy a live object rather than reconstruct it** — useful when construction is expensive or the object's configuration is easier to *copy* than to *specify*. Object Pool says **borrow, use, return** — the object outlives any single use; the client leases it. The unifying senior insight: all three trade the simplicity of "just `new` it" for control over instance count or cost, and each trade has a real price. Singleton trades testability. Prototype trades the risk of aliased shared mutable state through a botched shallow copy. Object Pool trades the risk of stale state leaking between borrowers and lifecycle bugs (double-return, use-after-return). Reach for them when the pressure they relieve is real and measured — not reflexively.

**Key terms**

- **Singleton** — one instance, one global access point (`getInstance()`), constructor made private.
- **Eager initialization** — instance created at class load; simple, thread-safe, but built even if never used.
- **Lazy initialization** — instance created on first `getInstance()` call; needs synchronization to be thread-safe.
- **Double-checked locking (DCL)** — check-lock-check pattern to avoid synchronizing after initialization; requires `volatile` in Java to be correct.
- **Initialization-on-demand holder** — lazy, thread-safe singleton via a static nested class; the JVM's class-init guarantees do the locking for free.
- **Enum singleton** — a single-element enum; the JVM guarantees one instance and serialization/reflection safety. Effective Java's recommended form.
- **Prototype** — create new objects by cloning a prototypical instance (`clone()`), not by construction.
- **Shallow copy** — copies field values; reference fields still point at the *same* nested objects (shared, aliased).
- **Deep copy** — recursively copies nested objects too; the clone shares nothing mutable with the original.
- **Object Pool** — a cache of reusable initialized objects leased to clients and returned, avoiding create/destroy churn.
- **Registry** — a central map of named prototypes or singletons you look up by key (`registry.get("fast-report")`).

**Why interviewers ask this**

Singleton is the single most over-used pattern in industry, so it is a reliable seniority probe. A junior candidate proudly writes a thread-safe singleton and stops. A senior candidate writes it *and then* explains why they would rather not: it is global mutable state wearing a design-pattern costume, it makes unit tests share hidden state across cases, it hides dependencies (a class that calls `Config.getInstance()` lies about what it needs), and it fights dependency injection. The interviewer is checking whether you reach for patterns reflexively or think about their costs. Prototype and Object Pool test whether you understand object *lifecycle and aliasing* — the shallow-vs-deep-copy question is really "do you understand reference semantics?", and Object Pool is really "do you know when reuse actually pays and when it is premature optimization that reintroduces manual memory management?"

**Common confusions**

- "Singleton means one object" — no, it means one *per classloader / JVM*. In a container with multiple classloaders (or multiple JVMs) you get one *each*. It is not a distributed guarantee.
- "Singleton and static class are the same" — a Singleton is an object (can implement interfaces, be passed as an argument, be lazily built, be mocked); a class of static methods cannot do any of those.
- "Double-checked locking without `volatile` is fine" — it is broken. Without `volatile` another thread can see a partially-constructed object due to instruction reordering.
- "`clone()` gives a deep copy" — Java's default `Object.clone()` is a *shallow* copy. Deep copy is your job.
- "Object Pool always improves performance" — for cheap objects it is pure overhead and reintroduces lifecycle bugs the GC would have prevented. Pool only genuinely expensive resources.
- "Prototype is just a copy constructor" — a copy constructor is one implementation; Prototype is the polymorphic idea (`clone()` on an interface) so you can copy without knowing the concrete type.

**What follows from this topic**

Singleton's downsides motivate **Dependency Injection** and the whole "program to an interface, inject collaborators" school covered under SOLID and coupling. Prototype pairs naturally with **Registry** and often appears inside **Abstract Factory** (a factory that clones prototypes). Object Pool connects to the Flyweight pattern (Structural II) — both are about not paying for objects you can share or reuse — and to the Concurrency primer (thread pools, connection pools). Once you can reason about instance count and lifecycle here, the Structural patterns that follow are about *composition and wrapping* rather than creation.

### Q1. Implement a thread-safe Singleton. Walk through the options.

There are five common forms. Know the trade-offs; interviewers push until you reach the holder or enum form.

**1. Eager** — simplest, thread-safe by class-init semantics, but always built:

```java
public final class Config {
    private static final Config INSTANCE = new Config();
    private Config() {}
    public static Config getInstance() { return INSTANCE; }
}
```

**2. Synchronized lazy** — correct but synchronizes *every* call forever:

```java
public static synchronized Config getInstance() {
    if (instance == null) instance = new Config();
    return instance;
}
```

**3. Double-checked locking** — lazy, synchronizes only during construction. `volatile` is mandatory:

```java
public final class Config {
    private static volatile Config instance;   // volatile is not optional
    private Config() {}
    public static Config getInstance() {
        if (instance == null) {                 // first check, no lock
            synchronized (Config.class) {
                if (instance == null)           // second check, with lock
                    instance = new Config();
            }
        }
        return instance;
    }
}
```

**4. Initialization-on-demand holder** — lazy and thread-safe with *no* synchronization in your code; the JVM guarantees a class is initialized once, on first use:

```java
public final class Config {
    private Config() {}
    private static class Holder { static final Config INSTANCE = new Config(); }
    public static Config getInstance() { return Holder.INSTANCE; }
}
```

**5. Enum** — Effective Java Item 3's recommendation; immune to reflection and serialization attacks:

```java
public enum Config { INSTANCE; public void load() { /* ... */ } }
```

Default to the **holder** idiom for a lazy singleton and **enum** when you want serialization/reflection safety for free. DCL is worth knowing but is easy to get subtly wrong.

### Q2. Why is double-checked locking broken without `volatile`?

`instance = new Config()` is not atomic. It is three steps: (1) allocate memory, (2) run the constructor, (3) publish the reference to `instance`. The JVM/CPU is allowed to **reorder** (3) before (2). So thread A can publish a non-null reference to a *not-yet-constructed* object; thread B passes the first `if (instance == null)` check, sees non-null, and returns a half-built object — reading default/garbage fields.

`volatile` fixes this by (a) forbidding that reordering and (b) establishing a happens-before edge so that once thread B sees the non-null reference, it also sees all the writes the constructor made. This is the canonical example of why memory-model reasoning matters — the code "looks" correct and passes tests, then fails one in a million times under load. The holder idiom sidesteps the whole problem by delegating to the JVM's class-initialization lock.

### Q3. What are the arguments that Singleton is an anti-pattern?

It usually is. The concrete objections:

- **Hidden global state.** A Singleton is a global variable with a nicer haircut. Any code anywhere can reach it and mutate it. Global mutable state makes program behavior depend on execution history, which is exactly what OO encapsulation exists to prevent.
- **Lies about dependencies.** A class that calls `Clock.getInstance()` internally has a hidden dependency on `Clock`. Its constructor signature says it needs nothing; that is a lie. Dependency Injection makes the dependency honest and visible.
- **Untestable.** Tests share the one instance, so state leaks between test cases and ordering matters. You cannot easily substitute a fake. `enum` singletons can't even be subclassed for a stub.
- **Tight coupling to a concrete type.** `getInstance()` returns a concrete class, so callers are welded to it — the opposite of "program to an interface."
- **Concurrency footguns.** A single shared mutable object is a contention and correctness hazard.

The senior move: keep the *"one instance"* lifecycle decision but move it to the **composition root** — construct one instance and inject it (as an interface) wherever needed. Your DI container enforces "one" (singleton scope) without any class knowing it is a singleton. You get the single-instance guarantee *and* testability.

```java
// Instead of Logger.getInstance() sprinkled everywhere:
class OrderService {
    private final Logger log;                       // depend on an interface
    OrderService(Logger log) { this.log = log; }    // injected; test passes a fake
}
```

### Q4. When is a Singleton actually acceptable?

When the "one instance" is a genuine invariant *and* the object is effectively **stateless or immutable**, so the untestability/global-state objections mostly evaporate. Good candidates: a stateless utility holder, an immutable configuration snapshot loaded once, a registry that is written once at startup and only read afterward. Even then, prefer injecting it as an interface so tests can substitute it — you can have "one instance in production" without the `getInstance()` global. The rule of thumb: if the singleton has mutable state that tests or subsystems both touch, it will bite you; if it is immutable/stateless, it is mostly harmless but still better injected than globally reached.

### Q5. Show the UML structure of Singleton.

```text
+-------------------------+
|        Singleton        |
+-------------------------+
| - instance : Singleton  |   <-- static, holds the one instance
| - Singleton()           |   <-- private constructor
+-------------------------+
| + getInstance():Singleton |  <-- static access point
| + businessMethod()      |
+-------------------------+
        ^
        | returns the single
        +---- instance to all callers
```

The two defining features in the diagram: the **private constructor** (nobody else can `new` it) and the **static self-typed field + static accessor** (the class owns and hands out its sole instance).

### Q6. How do reflection and serialization break a Singleton, and how do you defend it?

**Reflection** — `setAccessible(true)` on the private constructor lets an attacker call it and build a second instance. Defense: throw from the constructor if the instance already exists.

**Serialization** — deserializing a singleton creates a *new* object each time. Defense: implement `readResolve()` to return the existing instance.

```java
private Config() {
    if (instance != null) throw new IllegalStateException("Use getInstance()");
}
protected Object readResolve() { return getInstance(); }  // serialization guard
```

Both holes are why **enum singletons** are recommended: the JVM guarantees a single instance even against reflection, and enum serialization is handled specially so `readResolve` is unnecessary. If someone hands you a singleton and asks "how would you break it?", reflection and serialization are the two answers.

### Q7. What is the Prototype pattern and when do you use it?

**Intent:** create new objects by *cloning* a prototypical instance rather than calling `new`, so the client can copy objects without depending on their concrete classes.

Use it when: object construction is expensive (heavy initialization, DB/network round-trip to configure) and you already have a configured instance to copy; or when you want to produce many variants of a pre-configured object; or when the set of concrete classes is decided at runtime and you'd rather register prototypes than write a factory switch.

```text
+-------------+
| Prototype   |<interface>
+-------------+
| + clone():Prototype |
+-------------+
      ^  <|..
      |
+----------------+     +----------------+
| ConcreteProtoA |     | ConcreteProtoB |
| + clone()      |     | + clone()      |
+----------------+     +----------------+
```

```java
interface Shape { Shape clone(); }

class Circle implements Shape {
    int x, y, radius;
    Circle(Circle src) { this.x = src.x; this.y = src.y; this.radius = src.radius; } // copy ctor
    public Shape clone() { return new Circle(this); }
}

Circle template = configureExpensiveCircle();
Shape copy = template.clone();   // no re-configuration cost, no concrete type coupling
```

Real-world: JavaScript's whole object model is prototype-based; game engines clone a configured enemy template; document editors "duplicate" a styled shape.

### Q8. Shallow vs deep copy — what is the trap in Prototype?

`Object.clone()` and naive copy constructors do a **shallow** copy: primitive fields are copied by value, but reference fields are copied *by reference* — the clone and original point at the *same* nested objects. Mutate a nested object through the clone and you corrupt the original (aliasing).

```java
class Order implements Cloneable {
    List<Item> items;
    public Order clone() throws CloneNotSupportedException {
        Order c = (Order) super.clone();   // shallow: c.items == this.items (SAME list!)
        c.items = new ArrayList<>(this.items); // deep-ish: new list...
        // still shallow on the Items themselves — copy those too if they're mutable
        return c;
    }
}
```

Decide per field: immutable fields (String, boxed primitives, value objects) are safe to share shallowly; mutable nested objects must be deep-copied or you get spooky action at a distance. Deep copy is expensive and can hit cycles — for complex graphs, serialization-based deep copy or a purpose-built copy method is more honest than fighting `Cloneable`. In modern Java, prefer **copy constructors / static factory copy methods** over `Cloneable`, which is a broken interface (it has no `clone` method and `Object.clone` is `protected`).

### Q9. What is the Object Pool pattern and when is it worth it?

**Intent:** avoid the cost of creating and destroying expensive objects by keeping a pool of reusable, pre-initialized instances. Clients **acquire** an object, use it, and **release** it back instead of allocating and discarding.

Worth it only when object creation is genuinely expensive *and* frequent: database connections, threads, large reusable buffers, socket connections, expensive-to-construct parsers. For cheap objects it is pure overhead — you reintroduce manual lifecycle management (the exact thing GC frees you from) and risk stale-state and double-return bugs, all to avoid a cheap allocation.

```java
class ConnectionPool {
    private final Queue<Connection> idle = new ConcurrentLinkedQueue<>();
    private final int max;

    Connection acquire() {
        Connection c = idle.poll();
        return (c != null) ? c : createNewConnection();   // reuse or create
    }
    void release(Connection c) {
        c.reset();                 // CRITICAL: scrub state before reuse
        idle.offer(c);
    }
}
```

```text
Client --acquire()--> [ Pool: reset objs ] --> lease
Client --release()--> [ Pool ] --> object goes back to idle set
```

The three failure modes to mention: (1) **stale state** leaking between borrowers — always reset on release (or acquire); (2) **exhaustion** — decide block-vs-fail-vs-grow when the pool is empty; (3) **leaks** — a borrower that never returns its object. This is why real pools (HikariCP, thread pools) are hard and you should use a library, not hand-roll one.

### Q10. Contrast Object Pool with Flyweight and with Singleton.

| Pattern | Instances | Purpose | Client interaction |
|---|---|---|---|
| **Singleton** | Exactly 1 | One global point of access | Reaches the shared instance |
| **Object Pool** | Fixed set, reused over time | Amortize expensive create/destroy | Borrows and returns; exclusive use while leased |
| **Flyweight** | Many logical, few physical | Save memory by sharing intrinsic state | Shares read-only objects concurrently |

Key distinction: a pooled object is **leased exclusively** — one borrower at a time, mutated, then reset and returned. A flyweight is **shared concurrently** and must be immutable (intrinsic state only; extrinsic state is passed in). Singleton is one shared object that everyone uses at once. Confusing pool with flyweight is a common slip: "share to save memory" (flyweight) versus "reuse to save creation cost" (pool).

### Q11. What is the Registry idiom and how does it combine with Prototype?

A **Registry** is a central lookup table mapping keys to instances — often prototypes or singletons — so you can add new types by registering rather than editing a factory `switch`. It is the extensible cousin of a factory.

```java
class ShapeRegistry {
    private final Map<String, Shape> prototypes = new HashMap<>();
    void register(String key, Shape prototype) { prototypes.put(key, prototype); }
    Shape create(String key) { return prototypes.get(key).clone(); } // clone the prototype
}

registry.register("fast-node", configuredFastNode);
Shape s = registry.create("fast-node");   // returns a fresh clone
```

This satisfies the **Open/Closed Principle**: adding a new shape means registering a prototype at startup, not modifying `create`. Registries appear everywhere — service locators, plugin systems, MIME-type handlers, dialect registries. The caution: a mutable global registry is a Singleton in disguise and inherits its testability problems, so scope it and inject it rather than making it a static global.

### Q12. Refactor this Singleton-heavy code to be testable.

Before — hidden global dependencies, untestable:

```java
class PaymentService {
    void charge(Order o) {
        AuditLog.getInstance().record(o);              // hidden singleton
        double rate = FxRates.getInstance().usd();     // hidden singleton, mutable
        Gateway.getInstance().submit(o, rate);         // hidden singleton
    }
}
```

You cannot test `charge` without touching three real globals whose state bleeds across test cases. Refactor to inject the collaborators as interfaces:

```java
class PaymentService {
    private final AuditLog audit;
    private final FxRates fx;
    private final Gateway gateway;
    PaymentService(AuditLog audit, FxRates fx, Gateway gateway) { // dependencies now honest
        this.audit = audit; this.fx = fx; this.gateway = gateway;
    }
    void charge(Order o) {
        audit.record(o);
        gateway.submit(o, fx.usd());
    }
}
```

Now a test passes fakes/mocks; production wires one instance of each in the composition root (DI container "singleton scope" preserves the one-instance guarantee). Same lifecycle, no global reach. This is the standard answer to "how do you deal with legacy singletons?" — invert the dependency.

### Q13. Is a logger a legitimate Singleton?

It's the textbook "acceptable singleton," and mostly it is fine — but the nuance matters. A logger is *append-mostly* and effectively write-only shared state, so the global-mutable-state objection is weak. That's why logging frameworks expose `LoggerFactory.getLogger(Class)` — a global access point. However, for code you want to unit-test on *logging behavior* ("assert we logged a warning on failure"), inject the logger as an interface so you can substitute a capturing fake. Practical stance: use the framework's global accessor for convenience logging; inject when logging is part of the behavior under test. Don't build your own singleton logger — that's reinventing a solved problem.

### Q14. How does the enum Singleton guarantee one instance where DCL and holder don't fully?

Two ways it's stronger:

1. **Reflection-proof.** The JVM forbids reflective instantiation of enum constants — `Constructor.newInstance` on an enum throws `IllegalArgumentException`. DCL and holder singletons can be broken by `setAccessible(true)` on the private constructor.
2. **Serialization-safe.** Enum serialization writes only the constant *name* and deserialization maps it back to the existing constant via `Enum.valueOf` — no new object, no `readResolve` needed. DCL/holder singletons deserialize into fresh objects unless you add `readResolve`.

The cost: an enum can't extend a class (it already extends `Enum`) and can't be lazily instantiated across a complex dependency graph as flexibly. But for a simple stateless/immutable singleton it's the most robust form — hence Effective Java's recommendation.

### Q15. Design a connection pool. What are the key decisions?

Requirements: hand out reusable connections, cap the total, reset state between borrowers, handle exhaustion, evict dead/idle connections.

```text
+------------------+
|  ConnectionPool  |
+------------------+
| - idle: Deque    |  o--> Connection   (aggregation: pool holds connections)
| - inUse: Set     |
| - maxSize: int   |
+------------------+
| + acquire(): Connection   (blocks or fails when empty)
| + release(c)              (validate + reset, return to idle)
| + evictIdle()             (background reaper)
+------------------+
```

Key decisions to surface:
- **Exhaustion policy**: block with timeout (most common), fail fast, or grow past soft max? HikariCP blocks with a timeout.
- **Validation**: test-on-borrow vs test-on-return vs background reaper — dead connections must not be leased.
- **State reset**: rollback open transactions, clear session vars on release, or the next borrower inherits them.
- **Leak detection**: track lease time; log/reclaim connections held too long.
- **Fairness / thread-safety**: the idle set is contended; use a concurrent structure and a semaphore for the cap.

Close by noting you'd use HikariCP in production — the point of the exercise is showing you understand *why* pooling is subtle, not that you can out-engineer a battle-tested library.

### Q16. Prototype vs Factory Method — when clone, when construct?

Both create objects while decoupling the client from concrete types, but the mechanism differs. **Factory Method** *constructs* a fresh object via an overridable creation method — you subclass to decide the concrete class. **Prototype** *copies* an existing configured instance — you register/hold prototypes and clone them.

Choose **Prototype** when: construction is expensive but copying is cheap; the object's desired state is easier to express by copying a configured exemplar than by passing constructor args; or the set of types is dynamic and you'd rather register instances than write creator subclasses. Choose **Factory Method** when: each object should be freshly built (no meaningful "template" state to copy); you want a class hierarchy of creators; or copying would be error-prone (deep graphs, resources, identity that must be unique). A tell: if the interviewer says "and it must be a genuinely independent brand-new object with no shared references," that pressure favors construction (Factory Method) over clone (Prototype), because deep-copying correctly is the hard part of Prototype.

## Structural Patterns I: Adapter, Decorator & Facade

### Summary

**What this topic covers**

The first three structural patterns — the ones concerned with *making objects work together and composing behavior by wrapping*. (1) **Adapter** — converting one interface into another so two incompatible classes can collaborate, and the object-adapter (composition) vs class-adapter (inheritance) forms; (2) **Decorator** — adding responsibilities to an object dynamically by wrapping it in a same-interface wrapper, and how it beats the subclass-explosion you'd otherwise get; (3) **Facade** — providing one simplified interface over a complicated subsystem. The topic closes with the classic interview comparison: **Adapter vs Decorator vs Proxy vs Facade** — four patterns that all "wrap another object" but differ entirely in *intent*. Each pattern gets an intent line, a UML sketch, minimal code, a real example (Java's `InputStream`/`Reader` hierarchy is the canonical Decorator, and `InputStreamReader` is the canonical Adapter), and a "what it's confused with." Roughly 16 questions, warm-up ("what problem does Adapter solve") through senior ("here's a wrapper — which of the four patterns is it, and how do you tell?").

**Mental model**

Structural patterns are about **composition over inheritance made concrete**: instead of building tall class hierarchies, you assemble small objects that hold references to each other. The unifying shape of these three is "**an object that holds another object of a related type and forwards to it, adding something**." What differs is *what they add* and *why*:
- **Adapter** changes the **interface** but not the behavior — it translates. Client wants interface `A`, you have an object speaking interface `B`; the adapter speaks `A` and delegates to `B`.
- **Decorator** keeps the **same interface** and adds **behavior** — same type in, same type out, but enhanced. Because it implements the same interface as what it wraps, decorators stack.
- **Facade** invents a **new, simpler interface** in front of many objects — it doesn't wrap one object, it orchestrates several and hides them.
Ask, for any wrapper: *does it change the interface (Adapter), enhance behavior on the same interface (Decorator), or simplify a whole subsystem (Facade)?* That question resolves 90% of the confusion.

**Key terms**

- **Adapter (a.k.a. Wrapper)** — converts a class's interface into another interface clients expect.
- **Adaptee** — the existing class with the "wrong" interface that the adapter wraps.
- **Object adapter** — adapter *holds* the adaptee (composition); the flexible, preferred form.
- **Class adapter** — adapter *inherits* from the adaptee (multiple inheritance); limited, needs language support.
- **Decorator** — attaches additional responsibilities to an object dynamically; a wrapper sharing the component's interface.
- **Component interface** — the shared interface both the concrete object and its decorators implement.
- **Transparent wrapping** — because a decorator implements the component interface, clients can't tell they hold a decorated object.
- **Facade** — a unified, high-level interface over a set of interfaces in a subsystem.
- **Subsystem** — the tangle of classes the facade hides; still directly usable if a client needs the fine control.
- **Interface mismatch** — the core problem Adapter solves: two components you don't own that don't line up.
- **Subclass explosion** — the combinatorial blowup of subclasses Decorator avoids (`CompressedEncryptedBufferedStream`...).

**Why interviewers ask this**

These three separate candidates who *memorized pattern names* from candidates who *understand intent*. The killer question is "you have four patterns that all wrap an object — Adapter, Decorator, Proxy, Facade — how do you tell them apart?" A junior recites definitions; a senior answers by intent: interface conversion vs behavior addition vs access control vs simplification. Decorator specifically tests whether you understand the **composition-over-inheritance** argument in a concrete setting — if you can explain why `BufferedInputStream(new GZIPInputStream(new FileInputStream(...)))` is better than a class per combination, you understand the whole point of structural patterns. Facade tests whether you can talk about **coupling and layering** — does your code depend on a subsystem's 15 classes or on one facade? Interviewers also probe the real-world grounding: naming Java I/O streams as Decorator, `Arrays.asList`/`InputStreamReader` as Adapter, and a service layer as Facade signals you've read real code, not just a patterns book.

**Common confusions**

- "Adapter and Decorator are the same because both wrap" — no: Adapter *changes* the interface (client couldn't use the object before); Decorator *keeps* the interface (client could already use it, now it does more).
- "Facade and Adapter both simplify" — Facade invents a new simpler interface over *many* classes for convenience; Adapter converts *one* interface to a *specific expected* one for compatibility. Different intent, different scope.
- "Decorator changes the object's interface" — it must not. A decorator that adds public methods clients depend on breaks transparent stacking.
- "You need a class adapter" — rarely; object adapter (composition) is more flexible and doesn't need multiple inheritance. Prefer it.
- "Facade hides the subsystem so you can't use it directly" — it doesn't forbid direct access; it offers a convenient default. Power users can still reach past it.
- "Decorator and inheritance are interchangeable" — inheritance is static and compile-time; Decorator composes behavior at runtime and avoids the combinatorial subclass explosion.

**What follows from this topic**

Adapter is the pattern behind **ports & adapters / hexagonal architecture** (covered under designing-for-change): your domain defines a port interface, adapters translate to external tech. Decorator sets up **Proxy** (Structural II), which shares Decorator's exact structure but differs in intent (access control, not behavior addition) — the confusion is best resolved by studying them adjacently. Facade sets up the layering and coupling discussion and connects to **Mediator** (behavioral) which also centralizes interactions but for a different reason. The four-way comparison table here is one of the highest-yield things to have memorized for an LLD interview.

### Q1. What problem does the Adapter pattern solve, and what's its intent?

**Intent:** convert the interface of a class into another interface clients expect, letting classes work together that otherwise couldn't due to incompatible interfaces.

You reach for it when you have an existing, working class (often third-party or legacy — you can't change it) whose interface doesn't match what your code expects. Rather than rewrite either side, you slot a translator between them.

```text
Client ---> Target (interface client wants)
                 ^
                 | <|.. implements
             Adapter ----> Adaptee (has the "wrong" interface)
                    delegates/translates
```

```java
interface PaymentProcessor { void pay(int cents); }        // what our code expects

class LegacyGateway { void makePayment(double dollars) { /* ... */ } }  // can't change this

class LegacyGatewayAdapter implements PaymentProcessor {   // the adapter
    private final LegacyGateway legacy;
    LegacyGatewayAdapter(LegacyGateway legacy) { this.legacy = legacy; }
    public void pay(int cents) { legacy.makePayment(cents / 100.0); }   // translate
}
```

Real-world: `java.util.Arrays.asList()` adapts an array to `List`; `InputStreamReader` adapts a byte `InputStream` to a char `Reader`; a wrapper around a vendor SDK so your domain talks to *your* interface, not theirs.

### Q2. Object adapter vs class adapter — what's the difference?

| | Object adapter | Class adapter |
|---|---|---|
| Mechanism | **Composition** — holds the adaptee | **Inheritance** — extends the adaptee |
| Language need | Works everywhere | Needs multiple inheritance (limited in Java/C#) |
| Can adapt subclasses | Yes — wrap any subtype at runtime | No — bound to the one adaptee class at compile time |
| Overrides adaptee | No | Can override adaptee behavior |
| Preferred? | Yes, almost always | Rarely |

```java
// Object adapter (composition) — flexible, preferred:
class Adapter implements Target {
    private final Adaptee adaptee;                 // HOLDS it
    Adapter(Adaptee a) { this.adaptee = a; }
    public void request() { adaptee.specificRequest(); }
}

// Class adapter (inheritance) — Java can only do this if Target is an interface:
class Adapter2 extends Adaptee implements Target {  // INHERITS adaptee
    public void request() { specificRequest(); }    // inherited method
}
```

Prefer the object adapter: it follows composition-over-inheritance, works in single-inheritance languages, and can adapt an adaptee *and any of its subclasses* because it holds a reference rather than being welded to one class. Class adapter's only edge is overriding adaptee methods, which you rarely need.

### Q3. What is the Decorator pattern and what does it beat?

**Intent:** attach additional responsibilities to an object dynamically. Decorators provide a flexible alternative to subclassing for extending functionality.

It beats **subclass explosion**. Suppose a `Coffee` can be milked, sugared, whipped, and iced in any combination. Subclassing needs a class per combination — `MilkSugarCoffee`, `MilkWhipIcedCoffee`, ... 2^n classes. Decorator gives you *n* wrappers you compose at runtime.

```text
Component <interface> { cost(); }
   ^  <|..
   |----------------------------+
ConcreteComponent          Decorator (abstract, holds a Component)
 (e.g. Espresso)              ^  <>-- wraps a Component
                              |
                    +---------+---------+
                 MilkDecorator      SugarDecorator ...
```

```java
interface Coffee { double cost(); }
class Espresso implements Coffee { public double cost() { return 2.0; } }

abstract class CoffeeDecorator implements Coffee {   // same interface as Coffee
    protected final Coffee inner;
    CoffeeDecorator(Coffee inner) { this.inner = inner; }
}
class Milk extends CoffeeDecorator {
    Milk(Coffee c) { super(c); }
    public double cost() { return inner.cost() + 0.5; }   // delegate + add
}
class Sugar extends CoffeeDecorator {
    Sugar(Coffee c) { super(c); }
    public double cost() { return inner.cost() + 0.2; }
}

Coffee order = new Sugar(new Milk(new Espresso()));  // 2.0 + 0.5 + 0.2, composed at runtime
```

Because each decorator *implements the same interface* it wraps, they stack arbitrarily and the client never knows.

### Q4. Java I/O streams are the classic Decorator. Explain.

`java.io` is the textbook example. `InputStream` is the component interface; `FileInputStream` is a concrete component (a real source); `BufferedInputStream`, `GZIPInputStream`, `DataInputStream`, `CipherInputStream` are decorators — each wraps an `InputStream`, implements `InputStream`, and adds one responsibility (buffering, decompression, typed reads, decryption).

```java
InputStream in =
    new BufferedInputStream(        // adds buffering
        new GZIPInputStream(        // adds decompression
            new FileInputStream("data.gz")));  // the real source
```

Read from `in` and bytes flow up the chain: file -> gunzip -> buffer -> you. You compose exactly the behaviors you need, in order, at runtime. Without Decorator you'd need `BufferedGZIPFileInputStream`, `BufferedFileInputStream`, `GZIPFileInputStream`... every combination as a class. This is *the* example to cite — it proves Decorator solves a real problem in the standard library, and it shows the "same interface, stackable, adds behavior" property concretely.

### Q5. What is the Facade pattern?

**Intent:** provide a unified, higher-level interface to a set of interfaces in a subsystem, making the subsystem easier to use.

When a subsystem has many classes with intricate interactions, a facade offers one simple entry point for the common cases, so clients depend on *one* class instead of a dozen.

```text
Client ---> Facade
              |  orchestrates (delegates to many)
       +------+------+--------+
   VideoCodec   AudioMixer   FileWriter   ...   (subsystem classes)
```

```java
class MediaConverterFacade {                 // one simple door
    private final VideoCodec codec = new VideoCodec();
    private final AudioMixer mixer = new AudioMixer();
    private final FileWriter writer = new FileWriter();

    void convert(String src, String dst) {    // hides the messy dance
        var v = codec.decode(src);
        var a = mixer.extract(src);
        writer.write(dst, codec.encode(v), mixer.mix(a));
    }
}

// Client: converter.convert("a.avi", "a.mp4");  // doesn't touch codec/mixer/writer
```

Real-world: a service-layer class over repositories + validators + mappers; SLF4J over logging backends; jQuery over the DOM API. The facade **reduces coupling** — clients know one type — but does not *forbid* direct subsystem access for power users.

### Q6. Facade vs Adapter — both simplify, so how are they different?

Different intent and scope:

| | Facade | Adapter |
|---|---|---|
| Purpose | *Simplify* usage of a whole subsystem | *Convert* one interface to a specific expected one |
| Wraps | Many classes | Usually one adaptee |
| Target interface | A new, convenient interface you invent | A pre-existing interface the client already requires |
| Driven by | Complexity / coupling reduction | Interface incompatibility |

A Facade exists because a subsystem is *hard to use* — you design a friendlier front door. An Adapter exists because an object has the *wrong shape* to plug into an interface that already exists in your code. If the "expected interface" existed before you (client demands `PaymentProcessor`), it's Adapter. If you *invented* a simpler interface for convenience over many collaborators, it's Facade.

### Q7. Decorator vs inheritance — when is Decorator the right call?

Use **Decorator** when responsibilities are optional and combine in many ways, and you want to add/remove them at runtime. Use **inheritance** when the variation is a fixed, is-a specialization decided at compile time.

```text
Inheritance:  BufferedGZIPFileStream   <- one class per combination (explodes)
Decorator:    new Buffered(new GZIP(new File(...)))  <- compose n wrappers at runtime
```

Decorator wins when: (a) combinations are numerous (n behaviors -> 2^n subclasses); (b) you need to attach behavior to a *specific instance*, not the whole class; (c) you want to add/strip behavior dynamically. Inheritance wins when there's genuinely one axis of specialization and no combinatorial pressure — reaching for Decorator there is over-engineering. The trade-off cost of Decorator: lots of small objects, and debugging a deep wrapper stack is harder than reading one class; also identity/equality gets tricky because the decorated object is *not* the same object as its core.

### Q8. Give the four-way comparison: Adapter vs Decorator vs Proxy vs Facade.

All four hold a reference to another object and forward to it. **Intent** is the whole difference:

| Pattern | Intent | Interface vs wrapped object | Adds |
|---|---|---|---|
| **Adapter** | Make an incompatible interface usable | *Different* — converts B to A | Nothing (just translation) |
| **Decorator** | Add behavior dynamically | *Same* interface | New behavior, stackable |
| **Proxy** | Control access to the object | *Same* interface | Access control / laziness / remoting |
| **Facade** | Simplify a whole subsystem | *New* interface over *many* objects | Convenience, hides complexity |

The tells:
- **Different interface, translating an existing object** -> Adapter.
- **Same interface, does more work** -> Decorator.
- **Same interface, same behavior but gated (lazy-load, permission check, remote call)** -> Proxy.
- **New simple interface over many classes** -> Facade.

Decorator and Proxy are structurally *identical* (same interface, holds one object) — you distinguish them purely by *why*: Decorator enhances behavior and is meant to stack; Proxy controls access and typically manages the wrapped object's lifecycle (it may even create it). This table is worth memorizing verbatim; it's a near-guaranteed LLD interview question.

### Q9. Design an adapter for a third-party SDK you can't modify.

Requirements: your domain speaks `NotificationSender`; the vendor SDK exposes `AcmeSmsClient.dispatch(String, String, Map)`. Don't leak the vendor type into your domain.

```java
// Your domain port (owned by you, stable):
interface NotificationSender { void send(Notification n); }

// Vendor SDK (owned by them, can't change):
class AcmeSmsClient { void dispatch(String to, String body, Map<String,String> opts) { } }

// Adapter — the only class that knows about Acme:
class AcmeNotificationAdapter implements NotificationSender {
    private final AcmeSmsClient client;
    AcmeNotificationAdapter(AcmeSmsClient client) { this.client = client; }
    public void send(Notification n) {
        client.dispatch(n.recipient(), n.text(), Map.of("priority", n.priority()));
    }
}
```

```text
Domain ---> NotificationSender <|.. AcmeNotificationAdapter --> AcmeSmsClient (vendor)
```

The payoff: the vendor dependency is quarantined in one adapter. Swap vendors by writing a new adapter; the domain and all its tests never change. This is exactly the **ports & adapters** boundary — the adapter is where "our interface" meets "their interface." If asked "how do you keep a third-party library from spreading through your codebase," this is the answer.

### Q10. Can you decorate and adapt at the same time? Show a realistic stack.

Yes — real systems layer them, because their intents are orthogonal (translate vs enhance). A common shape: adapt a foreign source into your interface, then decorate it.

```java
// Adapt vendor stream to our Reader interface:
Reader base = new InputStreamReader(vendorInputStream, UTF_8);  // Adapter (bytes->chars)
// Decorate with buffering:
Reader buffered = new BufferedReader(base);                     // Decorator (adds buffering)
```

`InputStreamReader` is an **Adapter** (it converts a byte `InputStream` to a char `Reader` — different interface). `BufferedReader` is a **Decorator** (same `Reader` interface, adds buffering). Reading this stack tests whether you can classify each wrapper by intent even when they're adjacent. The lesson: don't ask "is this wrapper a decorator or adapter" globally — ask it *per layer*, because a single chain can contain both.

### Q11. When is Facade an anti-pattern or a smell?

Facade turns into a smell when:
- **God facade.** It grows into a 3,000-line class exposing 80 methods that touch everything — you replaced a tangled subsystem with a tangled front door. Split it by responsibility.
- **Leaky facade.** It returns subsystem types, forcing clients to `import` the very classes it was meant to hide, so it hides nothing.
- **Pointless pass-through.** If the "subsystem" is one class, the facade is a do-nothing indirection layer — YAGNI.
- **Blocking access.** If it *prevents* legitimate advanced use of the subsystem rather than just offering a convenient default, it forces ugly workarounds.

A healthy facade is thin, cohesive, returns *your* types (or simple values), and covers common cases while leaving the subsystem reachable. If it's fat and incohesive, it's a **God object** wearing a Facade label — apply Single Responsibility and split it.

### Q12. How does Adapter relate to hexagonal / ports-and-adapters architecture?

Directly — it's the pattern the architecture is named after. In hexagonal architecture your domain defines **ports** (interfaces it owns: `PaymentPort`, `NotificationPort`, `OrderRepository`). External technology (a payment API, an SMTP server, Postgres) is connected via **adapters** that implement those ports and translate to the outside world.

```text
        +-------------------+
        |   Domain core     |   defines ports (interfaces)
        |  PaymentPort  <|..|.. StripeAdapter --> Stripe SDK
        |  OrderRepo    <|..|.. JpaOrderAdapter --> Postgres
        +-------------------+
```

The dependency arrow points *inward*: adapters depend on the domain's port interface, never the reverse (**Dependency Inversion**). This is Adapter scaled up to an architectural principle — each adapter quarantines one external technology, the domain stays pure and testable (tests use in-memory adapters), and swapping a database or vendor means writing a new adapter, not touching the core. When an interviewer asks "how do you keep your business logic independent of frameworks and databases," ports-and-adapters is the answer, and Adapter is its atomic building block.

### Q13. Here's a wrapper class — how do you decide which pattern it is?

Ask three diagnostic questions in order:

1. **Does it change the interface the client sees?** If it exposes a *different* interface than the wrapped object (translating calls), it's an **Adapter**.
2. **If the interface is the same, does it add behavior or control access?** Same interface, doing extra work in the forwarded call (logging, buffering, extra computation you *want* every time) -> **Decorator**. Same interface, but the wrapper *gates* the call — lazy-instantiates the target, checks permissions, or forwards over the network -> **Proxy**.
3. **Does it front many objects with a new simple interface?** If it holds and orchestrates *several* collaborators behind one convenient interface -> **Facade**.

Concrete tells: a decorator is *meant to stack* and the client explicitly composes it (`new Buffered(new Gzip(x))`); a proxy is usually created *for* you and often *owns/creates* the real subject (you didn't hand it the target — it made one lazily); an adapter exists because two pre-existing interfaces don't line up; a facade wraps a whole package. If you can only cite the structure ("it wraps an object"), you'll confuse all four — the answer is always *intent*.

### Q14. Two-way adapter — what is it and when do you need one?

A **two-way adapter** implements *both* interfaces so an object can be used as either type. It's useful when two subsystems each expect their own interface and you want one object to satisfy both directions, or during a gradual migration where old and new code coexist.

```java
interface OldShape { void draw(int[] coords); }
interface NewShape { void render(Point p); }

class TwoWayShapeAdapter implements OldShape, NewShape {  // implements BOTH
    private final NewShape newImpl;
    TwoWayShapeAdapter(NewShape n) { this.newImpl = n; }
    public void draw(int[] c) { newImpl.render(new Point(c[0], c[1])); } // old->new
    public void render(Point p) { newImpl.render(p); }                   // pass-through
}
```

Now legacy code that expects `OldShape` and new code that expects `NewShape` can both hold the same object. This shines during **strangler-fig migrations** — you wrap the new implementation so both eras of the codebase can call it, then delete the old interface once migration completes. It's a niche but impressive answer that shows you've done real migration work.

### Q15. What's the performance and design cost of heavy decorator stacks?

Decorators are cheap conceptually but not free:

- **Object overhead & indirection.** Each layer is an allocation and an extra virtual call. A 6-deep stack means 6 delegations per operation. Usually negligible, occasionally hot-path-relevant.
- **Debugging difficulty.** A stack trace through `Buffered -> Gzip -> Cipher -> File` is harder to read than one class; a bug could live in any layer or in their *ordering* (decompress-then-decrypt vs decrypt-then-decompress are different!).
- **Ordering sensitivity.** Decorators are not always commutative — `Encrypt(Compress(x))` differs from `Compress(Encrypt(x))` (encrypted data doesn't compress). The client must order them correctly, and nothing enforces it.
- **Identity/equality traps.** The outermost decorator is a *different object* than its core, so `==`, `equals`, and `instanceof CoreType` behave surprisingly. `stream instanceof FileInputStream` is false once wrapped.
- **Interface bloat pressure.** If the component interface is wide, every decorator must implement (and correctly forward) every method — a fat interface makes decorators tedious and error-prone, so Decorator pairs badly with interfaces that violate Interface Segregation.

Mitigation: keep the component interface narrow, document required ordering, and don't decorate where a single class would do.

### Q16. Design a middleware/filter chain. Which pattern, and why not Chain of Responsibility?

Web middleware (auth -> logging -> compression -> handler) *looks* like a chain and is often built as **Decorator**, but the distinction from Chain of Responsibility (CoR) matters and interviewers probe it.

```java
interface Handler { Response handle(Request r); }

class LoggingMiddleware implements Handler {     // Decorator: same interface, wraps next
    private final Handler next;
    LoggingMiddleware(Handler next) { this.next = next; }
    public Response handle(Request r) {
        log(r);
        Response resp = next.handle(r);          // always delegates onward
        log(resp);
        return resp;
    }
}
Handler app = new LoggingMiddleware(new AuthMiddleware(new RouteHandler()));
```

**Decorator vs Chain of Responsibility here:**
- **Decorator** — *every* wrapper does its bit and *always* forwards; all layers run. It's about *composing behavior* around a single logical request. Middleware that always logs/compresses is Decorator-shaped.
- **Chain of Responsibility** — each handler decides whether to *handle and stop* or *pass along*; often exactly one handler processes the request (e.g. an event routed to the first handler that can deal with it). It's about *finding a handler*, not layering behavior.

The practical answer: request-processing middleware where every layer participates is a Decorator chain; a dispatch pipeline where one of many handlers claims the request (support-ticket routing, GUI event bubbling) is Chain of Responsibility. If the interviewer says "and only the first handler that can process it should," that's CoR; "and each layer wraps the response on the way out," that's Decorator.

## Structural Patterns II: Composite, Proxy, Bridge & Flyweight

### Summary

**What this topic covers**

The remaining four structural patterns — the ones about *trees, indirection, decoupling dimensions, and sharing*. (1) **Composite** — treating individual objects and compositions of objects uniformly through a common interface, so a client handles a leaf and a whole tree the same way (files/folders, UI component trees, org charts); (2) **Proxy** — a stand-in that controls access to another object, in its virtual (lazy-load), protection (permission), and remote (network) flavors; (3) **Bridge** — decoupling an abstraction from its implementation so the two vary independently, the classic cure for the *class explosion* you get when two dimensions of variation collide; (4) **Flyweight** — sharing common (intrinsic) state across many objects to save memory, pushing the varying (extrinsic) state out to the client. Each pattern gets an intent line, UML, minimal code, a real example, and a "when NOT to use it." The topic gives special attention to the perennial **Bridge vs Adapter** confusion. Roughly 16 questions, from "what problem does Composite solve" to "design a document/UI tree" and "you have a `Shape x Renderer x Platform` explosion — apply Bridge."

**Mental model**

Group these four by the problem each attacks. **Composite** is about *part-whole hierarchies*: when your data is a tree and you want to stop writing `if (leaf) ... else (loop over children)` everywhere, you give leaves and containers a common interface and recurse. **Proxy** is about *inserting a gatekeeper*: same interface as the real object, but the proxy decides *when and whether* the real work happens (lazily create it, check a permission, marshal a remote call, cache). **Bridge** is about *two independent axes of change*: when you feel a `M x N` subclass explosion coming (`RedCircle, BlueCircle, RedSquare, BlueSquare...`), you split the two dimensions into separate hierarchies joined by a reference — abstraction *has-a* implementor — so you write `M + N` classes instead of `M x N`. **Flyweight** is about *memory pressure from many similar objects*: separate the state that's *shared* (intrinsic — the same for many objects) from the state that's *unique* (extrinsic — passed in per use), and cache/share the intrinsic part. The senior framing: Composite = uniformity over trees; Proxy = controlled indirection; Bridge = decouple two dimensions; Flyweight = share to shrink.

**Key terms**

- **Composite** — compose objects into tree structures; treat individual (leaf) and composite objects uniformly.
- **Leaf / Composite node** — a leaf has no children; a composite holds children (which are themselves leaves or composites).
- **Component interface** — the shared type both leaf and composite implement, enabling uniform treatment.
- **Proxy** — a surrogate/placeholder controlling access to another object (the *real subject*), sharing its interface.
- **Virtual proxy** — defers creating an expensive real subject until it's actually needed (lazy loading).
- **Protection proxy** — checks access rights before forwarding to the real subject.
- **Remote proxy** — local stand-in for an object in another address space (marshals calls over the network).
- **Bridge** — decouple an abstraction from its implementation so both can vary independently via composition.
- **Abstraction vs Implementor** — Bridge's two hierarchies: the high-level control layer and the low-level platform layer.
- **Flyweight** — a shared object usable in multiple contexts simultaneously; stores only intrinsic state.
- **Intrinsic vs extrinsic state** — intrinsic is shared and stored in the flyweight; extrinsic varies per use and is passed in.

**Why interviewers ask this**

These test whether you can *recognize the structural pressure that calls for each pattern* rather than reciting names. Composite is the "your data is a tree — model it" test; getting it right (uniform interface, recursion) versus wrong (type-checking `if leaf/else`) is a clean seniority signal, and it appears in real LLD prompts (file system, org chart, UI layout, arithmetic-expression evaluator). Bridge is the most *misunderstood* GoF pattern, so being able to explain it — and distinguish it from Adapter — is a strong senior signal; the giveaway question is "you have shapes rendered by different renderers on different OSes and the subclasses are exploding — what do you do?" Flyweight tests whether you understand the intrinsic/extrinsic split and *object identity vs value* — and whether you know it's a specialized memory optimization, not a default. Proxy tests whether you can separate it from Decorator (same structure, different intent) and name the three flavors. Across all four, interviewers want evidence you apply patterns to relieve *measured* pressure, not decoratively.

**Common confusions**

- "Bridge and Adapter are the same" — Adapter makes two *existing, incompatible* interfaces work *after the fact*; Bridge is designed *up front* to let two dimensions vary independently. Intent and timing differ completely.
- "Proxy and Decorator are different structurally" — they're nearly identical structurally; the difference is intent (control access vs add behavior) and that a proxy often *creates/owns* the real subject.
- "Composite needs the leaf to implement child operations" — the transparency-vs-safety trade-off: put `add/remove` in the component interface (transparent, but leaves must reject them) or only in Composite (type-safe, but loses uniformity).
- "Flyweight objects can hold mutable per-instance state" — no; flyweights must be immutable and store only *shared* intrinsic state, or sharing corrupts. Extrinsic state is passed in, never stored.
- "Bridge is just composition" — it *is* implemented with composition, but specifically to split *two orthogonal dimensions* into separate hierarchies; not every use of composition is a Bridge.
- "A remote proxy hides that a call is remote, so it's free" — it hides the *mechanism*, not the *cost*; treating remote calls as local (ignoring latency/failure) is a classic distributed-systems mistake.

**What follows from this topic**

Composite pairs naturally with **Iterator** (traverse the tree), **Visitor** (add operations over the tree without touching node classes), and **Interpreter** (whose AST *is* a Composite) — all behavioral patterns covered elsewhere. Proxy connects to cross-cutting concerns and AOP (logging/caching/security proxies) and to lazy-loading in ORMs. Bridge is the deep expression of **"prefer composition over inheritance"** and **"program to an interface"** — the whole point is replacing a subclass explosion with delegation. Flyweight links back to **Object Pool** (Creational II) — both avoid paying full price for many objects, but Flyweight *shares immutable* objects concurrently while Pool *leases mutable* ones exclusively. Together these four complete the structural toolkit; the behavioral patterns that follow assume you can model object *structure* this fluently.

### Q1. What is the Composite pattern and what problem does it solve?

**Intent:** compose objects into tree structures to represent part-whole hierarchies, and let clients treat individual objects (leaves) and compositions (branches) *uniformly* through one interface.

It solves the "my code is full of `if (this is a single thing) ... else (loop over the group)`" problem. When data is recursively nested — a folder contains files and folders, a UI panel contains widgets and panels — you give every node a common interface and let composites delegate to their children.

```text
Component <interface> { render(); size(); }
    ^  <|..
    |----------------------+
  Leaf (File)          Composite (Folder)
  render()             render() { for child: child.render(); }  <>-- children: List<Component>
```

```java
interface FileNode { int size(); }

class File implements FileNode {                 // leaf
    private final int bytes;
    File(int bytes) { this.bytes = bytes; }
    public int size() { return bytes; }
}

class Folder implements FileNode {               // composite
    private final List<FileNode> children = new ArrayList<>();
    void add(FileNode n) { children.add(n); }
    public int size() {                          // recurse uniformly
        return children.stream().mapToInt(FileNode::size).sum();
    }
}

FileNode root = new Folder();   // client calls size() the same on a File or a Folder
```

The client calls `size()` without knowing or caring whether it holds a single file or a deep tree — that uniformity *is* the pattern.

### Q2. Transparency vs safety in Composite — where do add/remove go?

This is the key Composite design decision, and there's no free answer.

**Transparent** — declare child operations (`add`, `remove`, `getChild`) in the **component interface**. Leaves and composites share the exact same type, so clients treat them identically. Cost: `Leaf.add()` is meaningless and must throw or no-op — you've put an operation on a class that can't honor it (a mild Liskov/Interface-Segregation tension).

```java
interface Component {
    int size();
    default void add(Component c) { throw new UnsupportedOperationException(); } // leaves reject
}
```

**Safe** — declare child operations only on **Composite**. Leaves genuinely lack them, so the type system prevents `leaf.add(...)`. Cost: clients must *know* whether they hold a `Composite` (downcast / `instanceof`) to manage children, losing full uniformity.

```java
interface Component { int size(); }             // no child ops here
class Composite implements Component { void add(Component c) { } }  // child ops only here
```

GoF leans **transparent** (uniformity is the pattern's whole point), accepting that leaves reject structural operations. State the trade-off explicitly in an interview — recognizing it is the senior signal.

### Q3. Design an in-memory file system. Which pattern and what are the classes?

Requirements: files and directories; a directory contains files and directories; compute total size; find by path; render a tree. This is the canonical **Composite** prompt.

```text
FileSystemNode <interface> { name(); size(); print(indent); }
      ^  <|..
      |------------------------+
   FileLeaf                DirectoryComposite
   size = own bytes        size = sum of children   <>-- List<FileSystemNode>
```

```java
interface FSNode {
    String name();
    long size();
    void print(String indent);
}

class FileLeaf implements FSNode {
    private final String name; private final long bytes;
    FileLeaf(String name, long bytes) { this.name = name; this.bytes = bytes; }
    public String name() { return name; }
    public long size() { return bytes; }
    public void print(String indent) { System.out.println(indent + name + " (" + bytes + ")"); }
}

class DirectoryComposite implements FSNode {
    private final String name;
    private final List<FSNode> children = new ArrayList<>();
    DirectoryComposite(String name) { this.name = name; }
    void add(FSNode n) { children.add(n); }
    public String name() { return name; }
    public long size() { return children.stream().mapToLong(FSNode::size).sum(); } // recurse
    public void print(String indent) {
        System.out.println(indent + name + "/");
        children.forEach(c -> c.print(indent + "  "));
    }
}
```

Extensions to mention: add an **Iterator** to walk the tree; add a **Visitor** for operations like "count files by extension" without editing node classes; guard against cycles (symlinks) if the tree can become a graph. Patterns used: **Composite** (structure), optionally **Iterator/Visitor** (operations).

### Q4. What is the Proxy pattern and what are its three main flavors?

**Intent:** provide a surrogate or placeholder for another object to *control access* to it. The proxy implements the same interface as the real subject and decides when/whether to forward.

```text
Client ---> Subject <interface>
                ^  <|..
        +-------+--------+
   RealSubject        Proxy ----> RealSubject (holds/creates it, forwards conditionally)
```

Three flavors:

1. **Virtual proxy (lazy loading)** — defer creating an expensive real subject until first use. ORMs use this for lazy-loaded associations; an image viewer shows a placeholder until the full-res image is needed.
2. **Protection proxy** — check permissions before forwarding; deny unauthorized callers. A wrapper that verifies the caller's role before letting a method through.
3. **Remote proxy** — a local stand-in for an object living in another process/machine; it marshals the call over the network (RPC/RMI stubs, gRPC client stubs).

```java
interface Image { void display(); }
class RealImage implements Image {                 // expensive
    RealImage(String path) { loadFromDisk(path); }  // heavy work in constructor
    public void display() { }
}
class ImageProxy implements Image {                // virtual proxy
    private final String path;
    private RealImage real;                        // not created yet
    ImageProxy(String path) { this.path = path; }
    public void display() {
        if (real == null) real = new RealImage(path); // create on first real use
        real.display();
    }
}
```

Other flavors worth naming: **caching proxy** (memoize results) and **smart reference** (ref-counting, logging on access).

### Q5. Proxy vs Decorator — same structure, so how do they differ?

Structurally they're twins: both implement the wrapped object's interface and hold a reference to it. The difference is **intent** and **ownership**:

| | Decorator | Proxy |
|---|---|---|
| Intent | *Add* behavior/responsibilities | *Control* access to the object |
| Interface | Same as component | Same as subject |
| Stacking | Designed to stack (multiple decorators) | Usually one proxy, not stacked |
| Who creates the wrapped object | Client passes it in | Proxy often *creates/owns* it (lazily) |
| Example | `BufferedInputStream` adds buffering | Lazy-loading ORM proxy, security proxy |

The clean distinguishers: (1) a **decorator is handed** its target by the client and is meant to compose (`new A(new B(real))`); a **proxy typically manufactures or manages** its real subject (you didn't give it the target — it creates one on demand). (2) A decorator's *purpose is to do more work in the call*; a proxy's purpose is to *decide whether/when the call reaches the real object* (gate, delay, remote, cache). Same skeleton, opposite motivation — say "intent" and you've answered it.

### Q6. What is the Bridge pattern and what problem does it solve?

**Intent:** decouple an abstraction from its implementation so that the two can vary *independently*.

The problem it cures is **class explosion from two orthogonal dimensions**. Say you have shapes (`Circle`, `Square`) that can be drawn by different renderers (`VectorRenderer`, `RasterRenderer`). With inheritance you'd write `VectorCircle`, `RasterCircle`, `VectorSquare`, `RasterSquare` — `M x N` classes, and adding a third renderer means adding a subclass per shape. Bridge splits the two dimensions into separate hierarchies joined by a reference: `Shape` *has-a* `Renderer`. Now you write `M + N` classes and combine at runtime.

```text
   Abstraction (Shape) <>----> Implementor (Renderer) <interface>
        ^  <|--                         ^  <|..
        |                               |
   Circle, Square              VectorRenderer, RasterRenderer

  Shape holds a Renderer; the two hierarchies vary independently.
```

```java
interface Renderer { void renderCircle(float r); }              // implementor
class VectorRenderer implements Renderer { public void renderCircle(float r) { } }
class RasterRenderer implements Renderer { public void renderCircle(float r) { } }

abstract class Shape {                                            // abstraction
    protected final Renderer renderer;                           // the "bridge" reference
    Shape(Renderer renderer) { this.renderer = renderer; }
    abstract void draw();
}
class Circle extends Shape {
    private final float radius;
    Circle(Renderer r, float radius) { super(r); this.radius = radius; }
    void draw() { renderer.renderCircle(radius); }               // delegate to implementor
}

Shape s = new Circle(new VectorRenderer(), 5);   // mix any shape with any renderer at runtime
```

Add a renderer? One new `Renderer` class, zero shape changes. That independent extensibility is the whole point.

### Q7. Bridge vs Adapter — the classic confusion. Resolve it.

Both use composition and delegation, so beginners conflate them. The distinction is **intent and timing**:

| | Bridge | Adapter |
|---|---|---|
| Intent | Let abstraction and implementation *vary independently* | Make an *existing* incompatible interface *usable* |
| When designed | *Up front*, by design | *After the fact*, to fix a mismatch |
| Interfaces | Both sides designed together to fit | One side pre-exists with the "wrong" shape |
| Motivation | Prevent future class explosion / decouple dimensions | Reuse an existing class you can't change |

Put plainly: **Bridge is proactive design** — you *anticipate* two dimensions of change and structure your own classes so they don't multiply. **Adapter is reactive glue** — you have two things that already exist and don't fit, so you wrap one to match the other. Bridge's two hierarchies are *both yours and designed to collaborate*; Adapter bolts onto something with an interface you didn't choose (often third-party/legacy). If the question is "I'm about to build a system with shapes × renderers and want to avoid the combinatorial subclasses," that's Bridge. If it's "I have a working `LegacyThing` and my code expects `NewInterface`," that's Adapter.

### Q8. What is the Flyweight pattern? Explain intrinsic vs extrinsic state.

**Intent:** minimize memory use by *sharing* as much state as possible among many fine-grained objects, instead of giving each its own copy.

The key move is splitting an object's state:
- **Intrinsic state** — *shared*, context-independent, the same across many objects. Stored *in* the flyweight and immutable (e.g. a character's glyph shape and font; a tree's mesh and texture).
- **Extrinsic state** — *unique* per use, context-dependent. *Not* stored in the flyweight; passed in by the client on each call (e.g. the character's position on the page; the tree's x/y coordinates in the forest).

```text
FlyweightFactory --caches--> Flyweight (intrinsic only, shared, immutable)
Client passes extrinsic state --> flyweight.operation(extrinsicState)
```

```java
class TreeType {                                   // flyweight: intrinsic, shared
    final String name; final String texture;       // heavy, shared by thousands of trees
    TreeType(String name, String texture) { this.name = name; this.texture = texture; }
    void draw(int x, int y) { /* uses shared texture + passed-in position */ }  // extrinsic in
}

class TreeFactory {                                // ensures sharing
    private final Map<String, TreeType> cache = new HashMap<>();
    TreeType get(String name, String texture) {
        return cache.computeIfAbsent(name + texture, k -> new TreeType(name, texture));
    }
}
// A million trees share ~5 TreeType objects; each tree stores only x,y (extrinsic).
```

Classic uses: glyphs in a text editor, tiles/sprites in a game, `Integer.valueOf` caching -128..127. The factory that guarantees sharing is part of the pattern.

### Q9. Design the rendering of a million trees in a game with Flyweight.

Requirements: a forest of ~1,000,000 trees; each has a position, but they come in a handful of species (each with a big mesh + texture). Naively, each tree object holding its own mesh is gigabytes.

Split the state:
- **Intrinsic (shared, in the flyweight `TreeType`)**: species name, mesh, texture, color — heavy, identical across all trees of that species. A handful of these.
- **Extrinsic (per tree, stored by the client)**: x, y, scale — tiny.

```java
class TreeType {                        // flyweight (shared, immutable)
    final Mesh mesh; final Texture texture;
    TreeType(Mesh m, Texture t) { this.mesh = m; this.texture = t; }
    void draw(Canvas c, int x, int y) { c.draw(mesh, texture, x, y); }
}
class Tree {                            // context object: only extrinsic state + a shared ref
    final int x, y;
    final TreeType type;                // shared pointer, not a copy
    Tree(int x, int y, TreeType type) { this.x = x; this.y = y; this.type = type; }
    void draw(Canvas c) { type.draw(c, x, y); }
}
class Forest {
    private final Map<String, TreeType> types = new HashMap<>();  // flyweight factory
    private final List<Tree> trees = new ArrayList<>();
    void plant(int x, int y, String species, Mesh m, Texture t) {
        TreeType type = types.computeIfAbsent(species, k -> new TreeType(m, t)); // share
        trees.add(new Tree(x, y, type));
    }
}
```

Memory drops from "a million heavy trees" to "a million tiny `Tree` structs (x,y + a pointer) plus a few `TreeType` objects." That's the Flyweight win: intrinsic heavy state shared, extrinsic light state per instance.

### Q10. When should you NOT use Flyweight?

Flyweight is a specialized memory optimization with real costs — don't reach for it by default:

- **Few objects.** If you have hundreds, not millions, the sharing machinery and factory add complexity for negligible savings. Measure first.
- **Little shared state.** If objects don't share much intrinsic state, there's nothing to factor out — the pattern gives you nothing.
- **Mutable state.** Flyweights *must* be immutable; if the shared state needs to change per context, you can't share it. Trying to mutate a shared flyweight corrupts every user of it.
- **Extrinsic-state overhead.** Passing extrinsic state on every call (and the client managing it) can complicate code and even hurt performance if the extrinsic set is large — you've traded memory for CPU and complexity.
- **Identity matters.** Since many logical objects are the *same* physical object, `==` and per-object identity break. If clients need distinct identities, Flyweight is wrong.

Rule of thumb: Flyweight is justified when profiling shows memory blown by a huge number of objects with a small set of repeated heavy fields. Otherwise it's premature optimization that hurts readability.

### Q11. Show the UML for Composite and explain composition vs aggregation there.

```text
+------------------------+
|   Component            |<interface>
+------------------------+
| + operation()          |
+------------------------+
        ^  <|..
        |------------------------------+
+---------------+          +---------------------------+
|    Leaf       |          |       Composite           |
+---------------+          +---------------------------+
| + operation() |          | - children: List<Component> |
+---------------+          | + operation()             |
                           | + add(Component)          |
                           | + remove(Component)       |
                           +---------------------------+
                                    <>-- children (composition)
```

The `<>--` (filled diamond) from `Composite` to `Component` denotes **composition** when the parent *owns* its children's lifecycle — deleting a folder deletes the files under it. Use **aggregation** (`o--`, hollow diamond) instead when children can exist independently and are merely *referenced* — e.g. a "playlist" composed of songs that outlive the playlist, or a UI group referencing widgets owned elsewhere. The distinction matters for cleanup and cascade semantics: composition implies cascade-delete; aggregation does not. Naming which one applies (and why) when you draw a Composite is a senior detail interviewers notice.

### Q12. Implement a protection proxy that enforces permissions.

```java
interface Document {
    String read();
    void write(String content);
}

class RealDocument implements Document {
    private String content = "";
    public String read() { return content; }
    public void write(String content) { this.content = content; }
}

class ProtectedDocument implements Document {          // protection proxy
    private final RealDocument real;
    private final User user;
    ProtectedDocument(RealDocument real, User user) { this.real = real; this.user = user; }

    public String read() {
        if (!user.canRead()) throw new SecurityException("read denied");
        return real.read();                            // gate, then forward
    }
    public void write(String content) {
        if (!user.canWrite()) throw new SecurityException("write denied");
        real.write(content);
    }
}
```

The proxy shares `Document`'s interface, so callers can't tell they hold a proxy — but every call passes an access check before reaching the real object. This is how method-level security (Spring Security's `@PreAuthorize`, for instance) is implemented under the hood: a dynamically generated proxy wraps your bean and enforces the annotation. The point to make: the proxy adds *no business behavior* (that would be Decorator) — it only *controls whether the call proceeds*. Access control is the intent that makes this Proxy, not Decorator.

### Q13. Bridge vs the Strategy pattern — aren't both "composition to a variable part"?

They share the mechanism (hold a reference to an interface and delegate) but differ in *scope and intent*:

- **Strategy** (behavioral) swaps a *single algorithm/behavior* at runtime — "how do I sort / compute tax / route?" One dimension, one interchangeable operation, often changed on the fly.
- **Bridge** (structural) decouples an *entire abstraction hierarchy* from an *entire implementation hierarchy* so both can grow independently — "shapes × renderers." It's a structural decision made up front about *two dimensions of the design*, not a runtime behavior swap.

Put differently: Strategy is about *behavior* (the varying part is an algorithm); Bridge is about *structure* (the varying part is a whole platform/implementation layer, and there's a parallel abstraction layer on top). A telltale: with Bridge, the abstraction side is itself a refinable hierarchy (`Shape -> Circle, Square`) *and* holds an implementor hierarchy; with Strategy, there's typically just a context object holding one pluggable algorithm, no parallel abstraction hierarchy. They can coexist — a Bridge's implementor can be chosen like a Strategy — but the design question they answer is different.

### Q14. What are the downsides of Proxy, especially remote proxies?

General Proxy costs:
- **Indirection & latency.** Every call goes through the proxy; usually cheap, but a chain of proxies (security + caching + logging) adds up.
- **Complexity & debugging.** The object you hold isn't the real one; stack traces and identity checks get confusing (`instanceof RealType` may be false for a dynamic proxy).
- **Hidden behavior.** A proxy can silently change *when* things happen (lazy init triggering a DB load on an innocent-looking getter) — surprising in tight loops.

Remote proxies specifically carry the **distributed computing fallacies**:
- **Latency is not zero.** A remote proxy makes a network call *look* like a local method call, tempting callers to treat it as free. It isn't — chatty code that would be fine locally becomes catastrophic over the wire.
- **The network is unreliable.** Local calls don't throw `IOException` from nowhere; remote ones do. Hiding remoteness hides failure modes callers must actually handle.
- **Partial failure & serialization cost.** Arguments/results must be marshaled; large graphs are expensive, and the call can half-complete.

The senior point: a remote proxy hides the *mechanism* of remoting, but you must *not* let it hide the *cost and failure semantics*. Design remote-facing interfaces to be coarse-grained (few chatty calls) and make failure explicit.

### Q15. You have a `Shape x Color x Renderer` explosion. Walk through applying Bridge.

Symptom: you started with `Circle`/`Square`, then needed `RedCircle`/`BlueCircle`, then `VectorRedCircle`/`RasterBlueSquare`... The subclass count is the product of the dimensions — `shapes x colors x renderers` — and every new renderer multiplies everything. That combinatorial blowup is the Bridge trigger.

Diagnose the *independent dimensions*: **shape** (what to draw), **renderer** (how to draw it), and if color varies orthogonally, push it into the renderer or a separate axis. Separate each into its own hierarchy and connect them by reference:

```text
Shape (abstraction) <>--> Renderer (implementor)
  Circle, Square              VectorRenderer, RasterRenderer, SvgRenderer
```

```java
interface Renderer { void drawCircle(float r); void drawSquare(float s); }

abstract class Shape {
    protected final Renderer r;
    Shape(Renderer r) { this.r = r; }
    abstract void draw();
}
class Circle extends Shape {
    float radius; Circle(Renderer r, float radius) { super(r); this.radius = radius; }
    void draw() { r.drawCircle(radius); }
}

new Circle(new SvgRenderer(), 5).draw();   // any shape x any renderer, composed at runtime
```

Result: `M` shapes + `N` renderers = `M + N` classes instead of `M x N`. Adding an `SvgRenderer` is one class and touches zero shapes; adding a `Triangle` is one class and works with every existing renderer. State the before/after class count explicitly — that arithmetic *is* the justification for Bridge.

### Q16. Composite + Visitor, or Composite + Iterator — how do these combine on a tree?

Composite gives you the *structure*; you usually need *operations* over it, and two behavioral patterns pair with it cleanly:

**Composite + Iterator** — when you want to *traverse* all nodes uniformly (depth-first, breadth-first) without exposing the tree's internal shape. The iterator yields each node so clients loop instead of recursing manually.

```java
for (FSNode node : fileSystem)   // Iterator hides depth-first walk over the Composite
    if (node.name().endsWith(".log")) count++;
```

**Composite + Visitor** — when you want to add *new operations* over the tree (count-by-extension, total-size, export-to-JSON) *without editing every node class* each time. The Visitor holds the operation; nodes just `accept(visitor)`. This is powerful when node classes are stable but operations grow — it sidesteps the Composite's "every new operation means a method on Component and all subclasses" problem.

```java
interface FSVisitor { void visitFile(FileLeaf f); void visitDir(DirectoryComposite d); }
// each node implements accept(FSVisitor v); a SizeVisitor, a JsonExportVisitor, etc.
```

The trade-off to name: **Visitor** makes *adding operations* easy but *adding node types* hard (every visitor must gain a method); plain Composite methods make *adding node types* easy but *adding operations* hard (touch every class). Choose by which axis changes more — stable node set with growing operations favors Visitor; stable operations with growing node types favors methods on the Component. That "which dimension varies" reasoning is the same instinct Bridge rewards, and interviewers like seeing it applied here too.
## Behavioral Patterns I: Strategy, Observer & Command

### Summary

**What this topic covers**

Behavioral patterns are about how objects *interact* and *distribute responsibility* — not how they're built (creational) or composed (structural), but how they collaborate at runtime. This topic covers the three most-asked behavioral patterns: **Strategy** (make an algorithm interchangeable by wrapping it behind an interface and injecting it), **Observer** (let many objects react to one object's state change without that object knowing who they are), and **Command** (turn a request — "do X" — into a first-class object you can store, queue, log, and undo). These three show up constantly in real code: Strategy is the workhorse of "encapsulate what varies," Observer is the backbone of every event system and MVC/MVVM UI, and Command powers undo/redo, job queues, and macro recording. The 16 questions here move from "what problem does each solve" to the sharp senior distinctions — Strategy vs Command, the lapsed-listener leak in Observer, and when a lambda replaces the whole pattern.

**Mental model**

Behavioral patterns answer the question "who does what, and who talks to whom?" Think of them as ways to *decouple the trigger from the reaction*. In **Strategy** you decouple *what to do* from *when to do it*: the context knows *when* it needs an algorithm but delegates *which* algorithm to a plug-in object — swap the object, change the behavior, no `if/else`. In **Observer** you decouple *the event source* from *the reactors*: the subject fires "something changed" into the void and any number of subscribers pick it up — the subject never imports the subscriber. In **Command** you decouple *the invoker* from *the receiver* by reifying the request itself: instead of calling `receiver.doIt()` directly, you hand the invoker a `Command` object it can run later, log, or reverse. The common thread: each replaces a hard-wired method call with an *object you can pass around*, and that indirection buys you extensibility (add a strategy), scalability (add a listener), and time-shifting (queue a command).

**Key terms**

- **Strategy** — a family of interchangeable algorithms behind a common interface, selected at runtime.
- **Context** — in Strategy, the object that holds and delegates to a strategy.
- **Composition over inheritance** — Strategy's core insight: inject behavior instead of subclassing to override it.
- **Observer / Subject** — subject holds a list of observers and notifies them on change; observers implement an `update()` contract.
- **Publish-subscribe** — a looser Observer variant with a broker/event-bus between publisher and subscriber, often async and many-to-many.
- **Lapsed listener** — a memory leak where a subject holds a reference to an observer that should have been GC'd.
- **Command** — an object encapsulating a request: a receiver, an action, and its parameters.
- **Invoker** — the object that triggers a command's `execute()` without knowing what it does.
- **Receiver** — the object that actually performs the work when a command runs.
- **Undo/redo** — Command's signature capability: store executed commands, call `undo()` in reverse.
- **Macro command** — a composite command that runs a list of sub-commands.

**Why interviewers ask this**

These three separate people who *memorized the GoF catalog* from people who *design with it*. A junior recites "Strategy encapsulates algorithms"; a senior says "Strategy is just dependency injection of a function — in a language with first-class functions I'd often pass a lambda instead of a full interface" and knows *when the ceremony pays off*. Observer exposes whether you understand the failure modes that bite in production — the lapsed-listener leak, notification ordering, re-entrancy during a notify loop, and synchronous-vs-async delivery. Command reveals whether you can think about *requests as data* — the mental leap behind undo stacks, task queues, event sourcing, and CQRS commands. Interviewers also probe Strategy-vs-Command because they look identical (both wrap behavior in an object) but exist for opposite reasons, and confusing them signals pattern-matching without understanding.

**Common confusions**

- **"Strategy and Command are the same"** — both encapsulate behavior, but Strategy swaps *how* one operation is done (which algorithm), Command reifies *a whole request* to defer/queue/undo it. Different intents.
- **"Observer is the same as pub/sub"** — Observer is the GoF pattern with the subject directly holding observer references (usually synchronous, in-process); pub/sub adds a broker/event-bus decoupling publishers from subscribers (often async, cross-process).
- **"You always need a Strategy interface"** — in Java/Python/TS you can pass a lambda/function; the full interface is only worth it when strategies carry state or multiple methods.
- **"Observer notifications are safe to fire anywhere"** — notifying while iterating the observer list, or letting an observer mutate the subject, causes concurrent-modification and re-entrancy bugs.
- **"Command is overkill unless you need undo"** — queues, retries, logging, and macro recording are equally strong reasons; undo is just the famous one.

**What follows from this topic**

Strategy is the gateway to the whole "encapsulate what varies" family — it shares DNA with State (next topic) and Template Method, and the classic **Strategy vs State** confusion is covered there. Observer connects to Mediator (Behavioral III), which centralizes the many-to-many communication Observer distributes. Command sets up Chain of Responsibility (Behavioral II — both pass request-objects around) and Memento (Behavioral III — the state-capture side of undo). Together these three establish the core move behind all behavioral patterns: replace a direct call with an object.

### Q1. What problem does the Strategy pattern solve, and what is its structure?

**Intent:** define a family of algorithms, encapsulate each one, and make them interchangeable at runtime so the algorithm varies independently of the clients that use it.

The problem it kills is the sprawling conditional. You start with one shipping calculation, then add three more, and now a `calculateShipping()` method is a 60-line `switch` that everyone's afraid to touch. Every new option means editing that method — an Open/Closed violation. Strategy extracts each branch into its own class behind a common interface, and the context holds a reference to *one* of them.

```text
+-------------------+        +--------------------+
|   ShippingContext |------->| ShippingStrategy   |  <<interface>>
+-------------------+  uses  +--------------------+
| - strategy        |        | + cost(order):Money|
| + cost(order)     |        +--------------------+
+-------------------+                 ^
                                      | <|.. implements
              +-----------------------+------------------+
              |                       |                  |
     +----------------+   +-----------------+   +------------------+
     | StandardShip   |   | ExpressShip     |   | FreeShip         |
     +----------------+   +-----------------+   +------------------+
```

```java
interface ShippingStrategy { Money cost(Order order); }

class StandardShipping implements ShippingStrategy {
    public Money cost(Order o) { return Money.of(5.00); }
}
class ExpressShipping implements ShippingStrategy {
    public Money cost(Order o) { return Money.of(15.00); }
}

class Checkout {
    private ShippingStrategy strategy;              // injected
    Checkout(ShippingStrategy s) { this.strategy = s; }
    Money total(Order o) { return o.subtotal().plus(strategy.cost(o)); }
}
```

Swapping `new Checkout(new ExpressShipping())` for a different strategy changes behavior with zero edits to `Checkout`. New algorithm = new class, existing code untouched. That's Open/Closed in one move.

### Q2. How does Strategy embody "composition over inheritance"?

The inheritance approach to varying behavior is to subclass: `ExpressCheckout extends Checkout` overriding `cost()`. That breaks down fast. Behavior gets locked in at compile time (you can't change a `Checkout`'s shipping after construction), you get a combinatorial subclass explosion when a second axis varies (express-vs-standard × gift-wrap-vs-plain = four subclasses), and you can't reuse the shipping logic outside the `Checkout` hierarchy.

Strategy replaces "*is-a* subclass that overrides" with "*has-a* pluggable object." The `Checkout` **composes** a `ShippingStrategy` rather than inheriting one.

| | Inheritance (subclass to vary) | Strategy (compose behavior) |
|---|---|---|
| Bind time | Compile time, fixed | Runtime, swappable |
| Two varying axes | N×M subclasses | N + M strategies |
| Reuse behavior elsewhere | Trapped in hierarchy | Strategy object is portable |
| Change behavior on live object | Impossible | `setStrategy(...)` |

```java
checkout.setStrategy(new ExpressShipping());  // change behavior at runtime
```

This is *the* canonical illustration of "favor composition over inheritance" from the GoF — it's why the Strategy chapter is the one people cite for that principle.

### Q3. In a language with first-class functions, do you still need a Strategy interface?

Often not — and knowing when the full pattern is ceremony is a senior signal. If the strategy is a single stateless operation, a function/lambda *is* the strategy. The interface adds nothing.

```python
# No interface needed — the "strategy" is just a callable
def checkout(order, shipping_cost):        # shipping_cost: Callable[[Order], Money]
    return order.subtotal + shipping_cost(order)

checkout(order, lambda o: 15.00)           # express, inline
checkout(order, standard_shipping)         # named function
```

```typescript
type ShippingStrategy = (order: Order) => number;
const express: ShippingStrategy = o => 15;
class Checkout { constructor(private ship: ShippingStrategy) {} }
```

Keep the explicit interface when: (1) the strategy holds **state** or configuration (e.g. a `TieredDiscount` with rate tables); (2) it needs **multiple methods** (`cost()` *and* `estimatedDays()`); (3) you want **named, discoverable types** and DI-container wiring; or (4) you're in a language where functions aren't first-class. Otherwise, a lambda is the same pattern with less boilerplate — Strategy is, at its core, dependency injection of a function.

### Q4. Give a real-world example of Strategy in a standard library.

Java's `Comparator` is Strategy in the JDK. `Collections.sort(list, comparator)` uses a *fixed* sorting algorithm (the context) but the *comparison strategy* is injected:

```java
list.sort(Comparator.comparing(User::age));           // one strategy
list.sort(Comparator.comparing(User::name).reversed()); // another, no code change
```

Others: `java.util.concurrent`'s `RejectedExecutionHandler` (what a thread pool does when saturated — abort, discard, run-in-caller — is a pluggable strategy); Spring's `PasswordEncoder` (BCrypt vs Argon2 vs PBKDF2 behind one interface); React's virtualization or any framework taking a `keyExtractor` / `compareFn`; Python's `key=` argument to `sorted()`. Any API that takes a "how to do the variable part" callback is Strategy.

### Q5. What problem does the Observer pattern solve?

**Intent:** define a one-to-many dependency so that when one object (the *subject*) changes state, all its dependents (*observers*) are notified and updated automatically — without the subject knowing their concrete types.

The problem: you have a piece of state, and *N* other things need to react when it changes — a stock price updating three chart widgets, a model updating multiple views, an order-placed event triggering email + inventory + analytics. The naive approach hard-codes the reactions into the subject: `price.set(x)` calls `chart.redraw()`, `ticker.update()`, `log.write()`. Now the price object *imports* the chart, the ticker, and the logger — tight coupling, and every new reactor edits the subject.

```text
+------------------+  notifies   +----------------+  <<interface>>
|   Subject        |o----------->|   Observer     |
+------------------+   0..*      +----------------+
| + attach(o)      |             | + update(event)|
| + detach(o)      |             +----------------+
| + notify()       |                    ^
+------------------+                     | <|..
        ^                    +-----------+-----------+
        |                    |           |           |
+---------------+     +-----------+ +----------+ +---------+
| ConcreteSubj  |     | Chart     | | Ticker   | | Logger  |
+---------------+     +-----------+ +----------+ +---------+
```

Observer inverts the dependency: the subject holds a list of `Observer` interfaces and calls `update()` on each; the subject depends only on the *abstraction*. Add a fourth reactor by calling `subject.attach(newObserver)` — zero edits to the subject. That's the whole win: the event source stops knowing who's listening.

### Q6. Show a minimal Observer implementation and explain push vs pull.

```java
interface Observer { void update(StockEvent e); }

class Stock {
    private final List<Observer> observers = new CopyOnWriteArrayList<>();
    private BigDecimal price;

    void attach(Observer o) { observers.add(o); }
    void detach(Observer o) { observers.remove(o); }

    void setPrice(BigDecimal p) {
        this.price = p;
        StockEvent e = new StockEvent(this, p);
        for (Observer o : observers) o.update(e);   // notify
    }
}

class PriceChart implements Observer {
    public void update(StockEvent e) { redraw(e.price()); }
}
```

**Push model** (above): the subject sends the changed data *in* the notification (`StockEvent` carries the price). Simple, but the subject must guess what observers want, and pushes data some observers ignore.

**Pull model:** the subject sends a bare "something changed" signal and each observer calls back to fetch only what it needs (`e.getSubject().getPrice()`). More flexible, decoupled from the data shape, but chattier and can race if the state moves again before the observer pulls. Push is the common default; pull suits observers with divergent data needs.

Note the `CopyOnWriteArrayList` — see Q8 for why iterating the observer list needs care.

### Q7. What is the "lapsed listener" problem and how do you prevent it?

The **lapsed listener** (a.k.a. lapsed observer) is the classic Observer memory leak: an observer that's no longer needed never gets detached, so the subject's list keeps a strong reference to it, keeping it — and everything it reaches — alive forever. In a long-lived subject (a global event bus, a singleton model) attached to short-lived observers (dialog windows, request-scoped handlers), this leaks steadily.

```java
void openDialog() {
    Dialog d = new Dialog();
    stock.attach(d);        // attached...
    d.show();
}                           // ...dialog closed, but stock STILL references it -> leak
```

Fixes, in rough order of preference:

- **Explicit detach**: pair every `attach` with a `detach` in the observer's teardown (`dispose()`, `componentWillUnmount`, `close()`). Simple and correct, but easy to forget.
- **Weak references**: the subject holds `WeakReference<Observer>` so it doesn't keep observers alive; sweep dead refs on notify. Java's `WeakHashMap` or a `Set` of weak refs. Prevents the leak automatically but makes lifetime implicit (observer can vanish mid-stream).
- **Subscription handles**: `attach` returns a `Subscription`/`AutoCloseable` the caller `close()`s — makes the pairing visible and works with try-with-resources / RxJS `unsubscribe()`.
- **Framework lifecycle hooks**: React's `useEffect` cleanup, Angular's `takeUntil(destroy$)` — bind the subscription to a component lifecycle.

The senior answer names the leak *by name* and reaches for subscription handles or lifecycle-scoped unsubscription, treating explicit `detach` as necessary but error-prone.

### Q8. What goes wrong when an observer modifies the subject during notification?

Two real bugs: **concurrent modification** and **re-entrancy / ordering surprises**.

If an observer's `update()` calls `subject.attach()` or `detach()` while the subject is iterating its observer list, you get a `ConcurrentModificationException` (Java) or silently skipped/double-notified observers. If `update()` calls `subject.setPrice()` again, you re-enter the notification loop — potentially infinite recursion or a stack of half-finished notifications where observers see inconsistent intermediate state.

Defenses:

- **Iterate a snapshot**: copy the list before notifying (`new ArrayList<>(observers)`), or use `CopyOnWriteArrayList` so structural changes during iteration are safe.
- **Queue re-entrant changes**: if a notification triggers another state change, enqueue it and drain after the current loop finishes, rather than recursing.
- **Define ordering explicitly or not at all**: observers must not assume they run in a particular order; if order matters, that's a design smell pointing at Mediator or an explicit pipeline.
- **Deliver asynchronously**: post events to a queue/event-loop so `setPrice()` returns before observers run, sidestepping re-entrancy — at the cost of eventual (not immediate) consistency.

### Q9. How does Observer differ from publish-subscribe?

They share the goal — decouple event producers from consumers — but differ in *who holds the wiring*.

| | Observer (GoF) | Publish-Subscribe |
|---|---|---|
| Coupling | Subject directly holds observer refs | Broker/event-bus sits between |
| Knowledge | Subject knows its observers exist (has the list) | Publisher doesn't know subscribers exist |
| Delivery | Usually synchronous, in-process | Often asynchronous, can cross process/network |
| Topology | One subject → many observers | Many publishers → topics → many subscribers |
| Examples | Swing listeners, `PropertyChangeSupport` | Kafka, Redis pub/sub, DOM event bubbling, an in-app EventBus |

In Observer the subject *is* the registry. In pub/sub a **message broker** owns subscriptions and routing by *topic/channel*, so publishers fire into a topic with no reference to anyone. Pub/sub is essentially Observer with a Mediator inserted between the two sides, usually gaining async delivery and filtering. In an interview: Observer is the object-level pattern; pub/sub is the architectural generalization. (The distributed-messaging side belongs to the System Design primer — here, know the object-level distinction.)

### Q10. What problem does the Command pattern solve, and what is its structure?

**Intent:** encapsulate a request as an object, letting you parameterize clients with different requests, queue or log requests, and support undoable operations.

The problem: sometimes you need to treat "do this action" as *data* — to store it, pass it to a worker thread, put it on a retry queue, record it into a macro, or reverse it. A direct method call `light.on()` can't be stored or undone; it happens and is gone. Command turns the call into an object with an `execute()` (and optionally `undo()`), so the *request itself* becomes something you can hold.

```text
+-----------+   holds   +-------------+  <<interface>>
| Invoker   |o--------->|  Command    |
| (Button)  |           +-------------+
+-----------+           | + execute() |
                        | + undo()    |
                        +-------------+
                               ^
                               | <|..
                     +---------------------+
                     | LightOnCommand      |----> Receiver (Light)
                     | - receiver: Light   | calls receiver.on()
                     | + execute()         |
                     +---------------------+
```

```java
interface Command { void execute(); void undo(); }

class LightOnCommand implements Command {
    private final Light light;
    LightOnCommand(Light l) { this.light = l; }
    public void execute() { light.on(); }
    public void undo()    { light.off(); }
}

class Button {                       // Invoker — knows nothing about Light
    private Command command;
    void setCommand(Command c) { this.command = c; }
    void press() { command.execute(); }
}
```

The `Button` (invoker) is now reusable for *any* command — light, fan, garage door — because it depends only on `Command`. The request has become a first-class value.

### Q11. How does Command support undo/redo?

Give each command an `undo()` that reverses `execute()`, and keep an **undo stack** of executed commands. Undo pops and calls `undo()`; redo pushes to a second stack.

```java
class Editor {
    private final Deque<Command> undoStack = new ArrayDeque<>();
    private final Deque<Command> redoStack = new ArrayDeque<>();

    void run(Command c) {
        c.execute();
        undoStack.push(c);
        redoStack.clear();          // new action invalidates redo history
    }
    void undo() {
        if (undoStack.isEmpty()) return;
        Command c = undoStack.pop();
        c.undo();
        redoStack.push(c);
    }
    void redo() {
        if (redoStack.isEmpty()) return;
        Command c = redoStack.pop();
        c.execute();
        undoStack.push(c);
    }
}
```

The key design decision is *how a command reverses itself*. Two approaches: (1) **inverse operation** — `undo()` computes the reverse (insert ↔ delete); works when the action is cleanly invertible. (2) **state snapshot** — the command captures the affected state before executing and restores it on undo; this is where Command meets **Memento** (a command holds a memento of the pre-execution state). Use inverse ops when they're cheap and exact; use mementos when the operation is lossy or hard to reverse computationally.

### Q12. Beyond undo, what are the main uses of Command?

Undo is the famous one, but Command's real value is *time-shifting and reifying requests*:

- **Queuing / thread pools**: a `Runnable` is a Command; you submit it to an `ExecutorService` and a worker runs it later. The submitter and executor are fully decoupled.
- **Job/task queues**: serialize commands to a durable queue (DB, Redis, SQS), process them asynchronously, retry on failure. Each job is a command.
- **Macro / composite commands**: bundle a list of commands into one that runs them in sequence — recording and replaying a batch of edits.
- **Logging & replay / event sourcing**: persist every command; replay the log to rebuild state after a crash. This is the seed of event sourcing and CQRS *commands*.
- **Transactional operations**: run a set of commands, and if one fails, `undo()` the ones that succeeded (compensation).
- **Decoupling UI from logic**: menu item, toolbar button, and keyboard shortcut all trigger the *same* command object.

```java
class MacroCommand implements Command {
    private final List<Command> commands;
    MacroCommand(List<Command> c) { this.commands = c; }
    public void execute() { commands.forEach(Command::execute); }
    public void undo() {
        // reverse order so dependencies unwind correctly
        for (int i = commands.size() - 1; i >= 0; i--) commands.get(i).undo();
    }
}
```

### Q13. Strategy vs Command — how do you tell them apart?

They look identical on a UML diagram — both are an interface with a method, implemented by concrete classes, held by a context. The difference is *intent*, and it's a favorite interview trap.

| | Strategy | Command |
|---|---|---|
| Intent | Swap *how* one operation is performed | Reify *a whole request* to store/queue/undo/log it |
| Answers | "Which algorithm?" | "What action, and when does it run?" |
| Typical method | `cost()`, `compare()`, `encode()` — returns a result | `execute()` — performs a side effect |
| Lifetime | Usually set once, invoked repeatedly | Created per-request, often run once |
| Knows the receiver? | No — it *is* the behavior | Yes — it holds a receiver and calls it |
| Undo? | No | Often the whole point |
| Collected? | Rarely | Frequently — queues, stacks, macros |

Rule of thumb: if you're **choosing between interchangeable algorithms for a slot** ("which sort order," "which compression"), it's Strategy. If you're **packaging up an action to run/queue/reverse later** ("do this edit," "submit this job"), it's Command. Strategy varies a step *inside* an operation; Command *is* the operation, boxed for later. A Strategy typically computes and returns; a Command executes a side effect on a receiver.

### Q14. When should you NOT reach for these patterns?

**Strategy** — don't extract a Strategy when there's only ever going to be one algorithm, or when the "variation" is a single boolean that a guard clause handles cleanly. A Strategy interface with one implementation is speculative generality (YAGNI). Also skip the full interface when a lambda suffices (Q3).

**Observer** — don't use it when there's exactly one, always-present dependent — just call it directly; the indirection hides control flow and makes debugging ("who mutated this?") harder. Avoid deep observer chains (A notifies B notifies C notifies A) — they produce unpredictable cascades and re-entrancy bugs. If ordering or transactional consistency across reactors matters, Observer's fire-and-forget model fights you; consider Mediator or an explicit orchestration.

**Command** — don't wrap every method call in a Command "for flexibility." If you never queue, log, undo, or parameterize the invoker, a Command is just a verbose method call. The pattern earns its keep only when you actually treat requests as data. Over-applied, it scatters logic across dozens of tiny command classes and obscures a simple flow.

The meta-point interviewers want: patterns are answers to *specific pressures* (new variants, many reactors, deferred/reversible requests). No pressure, no pattern.

### Q15. Design a text editor's formatting and undo system. Which patterns?

Requirements: apply formatting (bold, italic, color) with different rules, and support unlimited undo/redo. This is a two-pattern problem.

**Strategy** for the *formatting rules* — each format is an interchangeable algorithm:

```java
interface FormatStrategy { void apply(TextRange r); }
class BoldFormat implements FormatStrategy { public void apply(TextRange r){ r.setWeight(BOLD);} }
class ColorFormat implements FormatStrategy {
    private final Color color;
    ColorFormat(Color c){ this.color = c; }
    public void apply(TextRange r){ r.setColor(color); }
}
```

**Command** for making each edit *undoable* — wrap "apply this format to this range" as a command that snapshots the prior state:

```java
class FormatCommand implements Command {
    private final TextRange range;
    private final FormatStrategy format;
    private Memento before;                       // Memento captures prior state
    FormatCommand(TextRange r, FormatStrategy f){ this.range=r; this.format=f; }
    public void execute(){ before = range.snapshot(); format.apply(range); }
    public void undo(){ range.restore(before); }
}
```

The `Editor` (Q11) holds the undo/redo stacks. So: **Strategy** varies *how* formatting works (add underline = new strategy, no other change), **Command** makes each application *reversible and stackable*, and **Memento** captures the pre-edit state for exact restore. Three behavioral patterns, each doing one job — that layered answer is what a senior gives instead of naming a single pattern.

### Q16. How would you implement Observer to notify subscribers asynchronously and safely?

Move from synchronous in-loop notification to an event-loop / executor, and design for failure isolation.

```java
class AsyncSubject {
    private final List<Observer> observers = new CopyOnWriteArrayList<>();
    private final ExecutorService pool = Executors.newFixedThreadPool(4);

    void attach(Observer o) { observers.add(o); }

    void publish(Event e) {
        for (Observer o : observers) {
            pool.submit(() -> {
                try { o.update(e); }
                catch (Exception ex) { log.warn("observer failed, others unaffected", ex); }
            });
        }
    }
}
```

Design points a senior raises:

- **Snapshot the list** (`CopyOnWriteArrayList`) so attach/detach during publish is safe.
- **Isolate failures**: one observer throwing must not block the rest — wrap each in try/catch. Synchronous Observer's worst trait is that a slow or throwing observer stalls the subject.
- **Async breaks re-entrancy**: `publish()` returns immediately, so an observer that triggers another change can't recurse into a half-finished loop — but you now have *eventual* consistency, and observers may see events out of order unless you serialize per-subject.
- **Backpressure**: an unbounded submit queue can OOM under a firehose; bound the queue and decide a drop/block policy — which is exactly the pub/sub broker's job, and the point where object-level Observer graduates into a messaging system.

## Behavioral Patterns II: State, Template Method & Chain of Responsibility

### Summary

**What this topic covers**

This topic covers three behavioral patterns about *controlling flow and behavior variation*: **State** (an object's behavior changes with its internal state — a finite state machine built from objects instead of a `switch`), **Template Method** (a base class fixes the *skeleton* of an algorithm and lets subclasses fill in the variable *steps* — the "Hollywood principle," don't-call-us-we'll-call-you), and **Chain of Responsibility** (a request travels along a chain of handlers until one handles it — the pattern behind middleware, servlet filters, and event bubbling). The through-line is *who decides what happens next*. State delegates the decision to a state object that can hand off to the next state; Template Method fixes the sequence in a superclass and inverts control over the steps; Chain of Responsibility lets each handler decide whether to act and whether to pass the request on. The 16 questions cover intent, structure, and code for each, plus the two most-tested distinctions in all of OOD: **Strategy vs State** and **Template Method vs Strategy**.

**Mental model**

Think of these as three answers to "how do I vary behavior without a giant conditional?" **State** answers "my behavior depends on *what mode I'm in*, and modes have *transitions*" — model each mode as a class, put the mode-specific behavior in it, and let each state know which state comes next. The `if (status == ...)` scattered across every method collapses into polymorphic dispatch on a `State` object. **Template Method** answers "the *overall algorithm* is fixed but a few *steps* differ" — write the sequence once in a base method (`final`, so subclasses can't reorder it) and declare the varying steps as abstract hooks. Control lives in the base; subclasses only supply pieces. **Chain of Responsibility** answers "a request should be offered to a *series* of handlers, and I don't know in advance which one handles it" — link handlers so each either processes the request or passes it along. The sender is decoupled from the receiver, and you can reorder, insert, or remove handlers freely.

**Key terms**

- **State pattern** — encapsulate state-specific behavior in separate objects; the context delegates to its current state.
- **Finite state machine (FSM)** — states + transitions; the State pattern is the OO realization of one.
- **Context** — the object whose behavior changes; holds a reference to the current state object.
- **State transition** — moving the context from one state object to another, often triggered by the state itself.
- **Template Method** — a base-class method defining an algorithm's skeleton, calling overridable step methods.
- **Hook method** — an optional step in a Template Method with a default (often empty) implementation subclasses may override.
- **Hollywood Principle** — "don't call us, we'll call you"; the base class calls the subclass's steps, inverting control.
- **Chain of Responsibility (CoR)** — handlers linked in a chain; each handles or forwards the request.
- **Handler** — a link in the chain with a `handle()` method and a reference to the next handler.
- **Middleware / pipeline** — the modern incarnation of CoR (Express, servlet filters, ASP.NET).
- **Event bubbling** — DOM's CoR: an event propagates up the element tree until handled or stopped.

**Why interviewers ask this**

State and Strategy have *identical* class diagrams, so "Strategy vs State" is the single most common design-pattern discriminator question — it tests whether you understand *intent over structure*, the theme of the entire GoF catalog. Getting it right ("Strategy's implementations are unaware of each other and set by the client; State's know each other and drive their own transitions") marks a candidate who reasons about patterns rather than memorizing UML. Template Method probes whether you grasp *inversion of control* — the base-class-calls-subclass inversion that underlies every framework you've ever used, from JUnit's `setUp()` to React lifecycle methods. Chain of Responsibility reveals whether you can design *pipelines* — the mental model behind middleware, interceptors, and filters that dominate modern web frameworks. Interviewers also use these to test *when not to* apply a pattern: a two-state flag doesn't need the State pattern, and Template Method's inheritance coupling is a liability people forget.

**Common confusions**

- **"State and Strategy are the same pattern"** — same diagram, opposite intent. Strategy = client picks one interchangeable algorithm; State = the object cycles through states that *transition to each other* and drive their own changes.
- **"Template Method and Strategy do the same thing"** — both vary steps of an algorithm, but Template Method uses *inheritance* (subclass overrides hooks, one algorithm skeleton) while Strategy uses *composition* (inject a whole algorithm object, swap at runtime).
- **"Chain of Responsibility guarantees a handler processes the request"** — it doesn't; the request can fall off the end unhandled. You must design for that case.
- **"State transitions belong in the context"** — they *can*, but the pattern often puts transition logic *in the state objects* so adding a state doesn't force edits to the context.
- **"Middleware isn't a design pattern"** — it's Chain of Responsibility, sometimes blended with Decorator (each middleware wraps `next`).

**What follows from this topic**

State is the sequel to Strategy (Behavioral I) — the two close the "encapsulate what varies" story, and the Strategy-vs-State table here is the payoff. Template Method's inversion of control connects to the Factory Method (a Template Method whose hook is object creation) and to the whole idea of framework design. Chain of Responsibility pairs with Command (Behavioral I) — both pass request-objects around — and with Decorator (Structural), which it structurally resembles. Together these establish flow-control-through-objects, setting up Mediator and Visitor in Behavioral III.

### Q1. What problem does the State pattern solve, and what is its structure?

**Intent:** allow an object to alter its behavior when its internal state changes — the object appears to change its class.

The problem is the *state-dependent conditional smell*: every method starts with `switch (this.status)` and each `case` does something different. A `Document` with states DRAFT / MODERATION / PUBLISHED has `publish()`, `edit()`, `render()` methods each branching on status. Adding an ARCHIVED state means editing *every* method — a shotgun-surgery, Open/Closed violation. State extracts each mode into its own class implementing a common interface; the context delegates to its current state object, and behavior changes by swapping that object.

```text
+----------------+   current   +----------------+  <<interface>>
|   Document     |o----------->|   State        |
| (Context)      |             +----------------+
+----------------+             | + publish(ctx) |
| - state        |             | + edit(ctx)    |
| + publish()    |--delegates->+----------------+
| + setState(s)  |                    ^
+----------------+                    | <|..
              +----------------+------+-------+----------------+
      +---------------+  +-----------------+  +-----------------+
      | Draft         |  | Moderation      |  | Published       |
      +---------------+  +-----------------+  +-----------------+
      | publish->Mod  |  | publish->Pub    |  | publish (no-op) |
      +---------------+  +-----------------+  +-----------------+
```

Each method becomes a one-line delegation, and the `switch` statements vanish into polymorphic dispatch.

### Q2. Show the State pattern in code, including transitions.

```java
interface DocState { void publish(Document ctx); }

class Draft implements DocState {
    public void publish(Document ctx) {
        ctx.setState(new Moderation());        // state drives the transition
    }
}
class Moderation implements DocState {
    public void publish(Document ctx) {
        if (ctx.currentUserIsAdmin()) ctx.setState(new Published());
        // non-admins can't advance — no transition
    }
}
class Published implements DocState {
    public void publish(Document ctx) { /* already published, no-op */ }
}

class Document {                                 // Context
    private DocState state = new Draft();
    void setState(DocState s) { this.state = s; }
    void publish() { state.publish(this); }      // delegate to current state
    boolean currentUserIsAdmin() { /* ... */ return false; }
}
```

Calling `doc.publish()` three times walks Draft → Moderation → Published, each state deciding the next. The context has *no* conditionals. Adding an `Archived` state = one new class + wiring the transition into whichever state precedes it; existing states barely change. The key design choice is *where transitions live*: putting them **inside the state objects** (as here) keeps the context clean and makes each state self-contained, at the cost of states knowing about each other. Putting them in the context centralizes the transition map but grows the context.

### Q3. Strategy vs State — they have the same UML. What's the actual difference?

This is *the* pattern-discrimination question. The class diagrams are near-identical (a context holding an interface with concrete implementations), so the answer must be about **intent and dynamics**, not structure.

| | Strategy | State |
|---|---|---|
| Intent | Choose one of several interchangeable algorithms | Change behavior as the object moves through states |
| Who sets it | The *client* injects the strategy | The object *transitions itself* (or a state does) |
| Do implementations know each other? | No — strategies are independent, mutually unaware | Yes — states reference and switch to *other* states |
| Changes over object's life? | Usually fixed once set | Constantly — that's the point |
| Mental model | Interchangeable *how* for one task | A finite state machine |
| Number of transitions | None — it's just a plug-in | Defined transition graph between states |

The crisp distinctions: **(1) awareness** — Strategy implementations don't know the others exist and never switch to one another; State objects *do* and typically trigger transitions to sibling states. **(2) who drives change** — with Strategy the *client* decides which algorithm and sets it; with State the transitions are *internal* to the machine, driven by events. **(3) intent** — Strategy answers "which algorithm for this operation?"; State answers "what mode am I in, and what happens next?". Same skeleton, opposite purpose. If your objects *transition to each other* in a defined graph, it's State; if they're *interchangeable parts a client swaps in*, it's Strategy.

### Q4. When is the State pattern overkill?

State earns its complexity only when there are genuinely multiple states *with multiple state-dependent behaviors* and non-trivial transitions. Skip it when:

- **Two states / one boolean**: an `enabled` flag doesn't need two classes. `if (!enabled) return;` is clearer than a State hierarchy.
- **States differ in data, not behavior**: if the methods behave the same and only a field changes, an enum field is enough.
- **A simple enum-driven `switch` is stable**: if you rarely add states and each method's branching is short, a `switch` on an enum can be more readable than scattering logic across many small classes — the State pattern trades one big readable switch for many files.
- **Transitions are trivial/linear**: a strictly linear DRAFT→PUBLISHED with no branching barely benefits.

The cost of State is object proliferation and indirection — to understand the flow you jump across N classes instead of reading one `switch`. Apply it when the conditional *smell* is real (repeated across methods, growing, Open/Closed pain), not preemptively. An enum + a transition table is a legitimate middle ground for FSMs with many states but uniform, table-driven behavior.

### Q5. What problem does Template Method solve, and what is its structure?

**Intent:** define the skeleton of an algorithm in a base-class method, deferring some steps to subclasses; subclasses redefine certain steps without changing the algorithm's overall structure.

The problem is *duplicated structure with varying details*. Two data importers both: open the file, parse it, validate, save, close — identical sequence, but CSV parses differently from JSON. Copy-pasting the skeleton into each class duplicates the *control flow*; if you later add a "log progress" step, you edit every copy. Template Method hoists the fixed sequence into a base-class method and declares the varying steps as abstract (or hook) methods.

```text
+--------------------------+
| DataImporter (abstract)  |
+--------------------------+
| + import() final  <-- template method: fixed skeleton
|     open(); parse();     |
|     validate(); save();  |
| # parse()   {abstract}   |  <-- steps subclasses fill in
| # validate(){abstract}   |
| # onDone()  {hook, empty}|  <-- optional hook
+--------------------------+
            ^  <|--
     +------+------+
+-----------+  +-----------+
| CsvImport |  | JsonImport|
| parse()   |  | parse()   |
+-----------+  +-----------+
```

```java
abstract class DataImporter {
    public final void importData() {   // final: skeleton can't be reordered
        open();
        List<Row> rows = parse();      // subclass step
        validate(rows);                // subclass step
        save(rows);
        onDone();                      // hook — default no-op
    }
    protected abstract List<Row> parse();
    protected abstract void validate(List<Row> rows);
    protected void onDone() { }        // hook: override optionally
    private void open() { /* shared */ }
    private void save(List<Row> r) { /* shared */ }
}
class CsvImporter extends DataImporter {
    protected List<Row> parse() { /* CSV */ return List.of(); }
    protected void validate(List<Row> r) { /* ... */ }
}
```

The template method is `final` so subclasses can't change the *order* — they only fill the blanks.

### Q6. What is the Hollywood Principle and how does Template Method embody it?

**"Don't call us, we'll call you"** — the *Hollywood Principle* — describes **inversion of control**: high-level code (the base class / framework) calls into low-level code (your subclass / step), not the other way around. In a normal library you call *its* functions; with Template Method (and frameworks generally) *it* calls *your* overridden methods at the points it chooses.

In Template Method, the subclass never invokes the algorithm's steps in order — it *can't*, the sequence is locked in the base's `final` method. The subclass just *supplies* `parse()` and `validate()`; the base class decides when to call them. Control lives at the top; the subclass is called back.

This is exactly how frameworks work: JUnit calls your `@BeforeEach`/`@Test` methods; a servlet container calls your `doGet()`; React calls your `render()` and lifecycle hooks; Spring calls your `@PostConstruct`. You don't run the framework's loop — it runs yours. Template Method is the object-level seed of that inversion, which is why interviewers use it to check whether you understand framework design versus library usage.

### Q7. Template Method vs Strategy — both vary steps of an algorithm. How do they differ?

Both let you vary parts of an algorithm; the axis is **inheritance vs composition**, and it's a frequently tested pair.

| | Template Method | Strategy |
|---|---|---|
| Mechanism | Inheritance — subclass overrides hook methods | Composition — inject an algorithm object |
| What varies | *Steps* within one fixed skeleton | The *whole* algorithm |
| Binding | Compile time (which subclass) | Runtime (swap the object) |
| Skeleton lives in | The base class, once | The context, or nowhere — each strategy is whole |
| Coupling | Tight — subclass bound to base class internals | Loose — context depends only on an interface |
| Change behavior on live object | No (identity is fixed) | Yes (`setStrategy`) |
| Reuse a step elsewhere | Hard (trapped in hierarchy) | Easy (strategy object is portable) |

**Template Method** keeps *one* algorithm skeleton and lets subclasses vary *steps* via inheritance — good when the overall sequence is genuinely invariant and shared. **Strategy** swaps a *whole* pluggable algorithm via composition — good when you want runtime swapping and to avoid inheritance coupling. The modern lean is toward Strategy (composition over inheritance): Template Method's downside is the fragile-base-class coupling and inability to change behavior at runtime. A common refactor is turning a Template Method's varying steps *into* injected strategies when the inheritance tree gets unwieldy. Note the Factory Method pattern is literally a Template Method whose overridable step is object creation.

### Q8. What are the drawbacks of Template Method?

Template Method's power — inheritance — is also its weakness:

- **Fragile base class**: subclasses depend on the base class's internal call sequence and protected members. Change the skeleton or a step signature and every subclass can break. This is the classic inheritance-coupling problem.
- **Inheritance is compile-time and single**: you can't change the algorithm at runtime, and in single-inheritance languages you *spend* your one superclass slot on it.
- **Liskov risk**: a subclass's overridden step can violate the base's contract (return null, throw, mutate shared state), breaking the algorithm in ways the base author didn't anticipate.
- **Hidden control flow**: reading a subclass, you can't see the algorithm — it's in the parent. Following execution means bouncing between files. (State has the same jump-around cost.)
- **Limited flexibility**: adding a genuinely new variation point means editing the base class and *all* subclasses.

The senior move is to prefer **Strategy** (or plain composition/callbacks) when these bite — inject the varying steps as function objects instead of overriding them. Template Method is fine for a stable skeleton with a few closely-related variants; it ages badly when the hierarchy grows or the steps want to vary independently.

### Q9. What problem does Chain of Responsibility solve, and what is its structure?

**Intent:** avoid coupling the sender of a request to its receiver by giving more than one object a chance to handle it; chain the receivers and pass the request along until one handles it.

The problem: a request might be handled by one of several handlers, and you don't want the sender to know *which*, or to hard-code the selection logic. Think approval flows (a $500 expense goes to a manager, $5,000 to a director, $50,000 to the VP), or request processing (authenticate → rate-limit → validate → route). A big `if/else` picking the handler couples the sender to all of them and is painful to reorder. CoR links handlers so each decides: *handle it, or pass to the next*.

```text
Client --> Handler1 --> Handler2 --> Handler3 --> (end)
             |            |            |
         handle or    handle or    handle or
         forward      forward      forward
```

```text
+------------------+  <<abstract>>
|   Handler        |
+------------------+
| - next: Handler  |o--+  (points to next in chain)
| + setNext(h)     |   |
| + handle(req)    |<--+
+------------------+
        ^ <|--
   +----+-----+-----------+
+-----------+ +------------+ +-----------+
| ManagerH  | | DirectorH  | | VpHandler |
+-----------+ +------------+ +-----------+
```

The sender holds only the *head* of the chain and calls `handle()`; it has no idea who ultimately responds. Handlers can be reordered, inserted, or removed by rewiring `next`.

### Q10. Show a Chain of Responsibility implementation.

```java
abstract class Approver {
    protected Approver next;
    Approver setNext(Approver n) { this.next = n; return n; }   // fluent chaining

    void handle(Expense e) {
        if (canApprove(e)) approve(e);
        else if (next != null) next.handle(e);                  // forward
        else reject(e);                                         // fell off the end
    }
    protected abstract boolean canApprove(Expense e);
    protected abstract void approve(Expense e);
    private void reject(Expense e) { /* nobody could approve */ }
}

class Manager extends Approver {
    protected boolean canApprove(Expense e) { return e.amount() <= 1_000; }
    protected void approve(Expense e) { /* stamp */ }
}
class Director extends Approver {
    protected boolean canApprove(Expense e) { return e.amount() <= 10_000; }
    protected void approve(Expense e) { /* stamp */ }
}

// Wiring:
Approver chain = new Manager();
chain.setNext(new Director()).setNext(new Vp());
chain.handle(new Expense(5_000));   // Manager passes -> Director approves
```

Two design decisions: (1) **stop or continue after handling** — an *approval* chain stops at the first handler that can approve; a *pipeline* (logging, then auth, then routing) may want *every* handler to run and pass through. (2) **guarantee handling or not** — this chain calls `reject()` if nobody handles it; some chains legitimately let requests fall off the end. Always design the unhandled case explicitly.

### Q11. Where does Chain of Responsibility show up in real frameworks?

CoR is everywhere in web infrastructure, usually under the name **middleware / filters / interceptors**:

- **Express.js / Koa middleware**: each `(req, res, next)` handler processes the request and calls `next()` to forward it. Auth, logging, body-parsing, CORS — a literal chain.
- **Java Servlet `Filter` chain**: `doFilter(req, res, chain)` then `chain.doFilter(...)` to continue. Same pattern.
- **ASP.NET Core middleware pipeline**: `app.Use(async (ctx, next) => { ...; await next(); })`.
- **Spring `HandlerInterceptor` / Security filter chain**: a chain of interceptors around request handling.
- **DOM event bubbling**: an event propagates up the element tree; each ancestor's handler can process it or let it bubble, and `stopPropagation()` ends the chain — CoR in the browser.
- **Logging frameworks**: log-level handlers where a message passes to the first handler that accepts its level.
- **Exception handling**: try/catch up the call stack is conceptually a CoR — each frame handles or rethrows.

Middleware often *blends CoR with Decorator*: each middleware wraps the `next` handler, so it can run code *before and after* the rest of the chain, not just decide whether to forward. Pure CoR is "handle or pass"; middleware is "wrap and pass," which is why the two patterns get mentioned together.

### Q12. When should you NOT use Chain of Responsibility?

- **When exactly one handler always applies and you know which**: just call it. The chain adds indirection and a runtime search for no benefit.
- **When every request must be handled**: CoR allows requests to fall off the end unhandled; if that's never acceptable, a chain hides a bug behind "maybe nobody responded." Add an explicit terminal handler or use a different structure.
- **When you need guaranteed ordering with strong coupling between steps**: if step 3 depends intricately on step 1's internals, the loose CoR wiring makes that dependency invisible and fragile — an explicit pipeline object is clearer.
- **Debuggability concerns**: with a long chain it can be hard to see *why* a request was (or wasn't) handled — the control flow is spread across handlers and runtime wiring. For a fixed, well-understood sequence, a plain method with ordered calls is more readable.

CoR shines when the set of handlers is *dynamic*, *reorderable*, or *open for extension* (add a handler without touching the sender). If it's static and small, a straight sequence of calls beats the machinery.

### Q13. Compare State, Template Method, and Chain of Responsibility — when do you reach for each?

All three control *flow*, but for different shapes of problem:

| Pattern | Use when | Mechanism | Real example |
|---|---|---|---|
| **State** | Behavior depends on a *mode* with defined *transitions* between modes | Delegate to a current-state object that swaps itself | Order lifecycle, TCP connection, UI wizard |
| **Template Method** | One *fixed algorithm skeleton*, a few *varying steps* | Base method calls overridable subclass hooks | Framework lifecycle, data import pipeline |
| **Chain of Responsibility** | A request should be offered to a *series of handlers*, unknown which handles it | Link handlers; each handles or forwards | Middleware, approval flow, event bubbling |

Decision cues: if you're modeling *modes and transitions* (a thing that *becomes* something else and behaves differently), reach for **State**. If you have *duplicated structure with pluggable steps* and a stable sequence, reach for **Template Method** (or Strategy if you want composition). If you have *a request and multiple candidate handlers* where responsibility is distributed and extensible, reach for **Chain of Responsibility**. They compose too — a middleware chain (CoR) where each handler runs a Template-Method-shaped process, driving a Context through States, is an ordinary real system.

### Q14. How would you model a vending machine's control logic? Which pattern?

A vending machine is the textbook **State** machine: its behavior in response to the same inputs (insert coin, select item, dispense) depends entirely on its current mode.

States: `NoCoinState`, `HasCoinState`, `SoldState`, `SoldOutState`. Each responds differently to the same events:

```java
interface State {
    void insertCoin(Machine m);
    void selectItem(Machine m);
    void dispense(Machine m);
}
class NoCoinState implements State {
    public void insertCoin(Machine m) { m.setState(m.hasCoin()); }   // -> HasCoin
    public void selectItem(Machine m) { /* reject: insert coin first */ }
    public void dispense(Machine m)   { /* nothing to dispense */ }
}
class HasCoinState implements State {
    public void insertCoin(Machine m) { /* already have a coin */ }
    public void selectItem(Machine m) { m.setState(m.sold()); }      // -> Sold
    public void dispense(Machine m)   { /* select first */ }
}
class SoldState implements State {
    public void insertCoin(Machine m) { /* wait, dispensing */ }
    public void selectItem(Machine m) { /* already selecting */ }
    public void dispense(Machine m) {
        m.releaseItem();
        m.setState(m.count() > 0 ? m.noCoin() : m.soldOut());        // transition on stock
    }
}
class Machine {
    private State state = new NoCoinState();
    void setState(State s) { state = s; }
    void insertCoin() { state.insertCoin(this); }
    void selectItem() { state.selectItem(this); }
    // ...factory-ish accessors: noCoin(), hasCoin(), sold(), soldOut()
}
```

Why State beats a `switch`: the same three inputs have four different responses each — a `switch(mode)` inside every method is exactly the smell State removes. Each state is self-contained, illegal transitions are handled naturally (a no-op or rejection *in that state*), and adding a `SoldOutState` doesn't touch the others. In an LLD interview, name the states, draw the transition diagram, then show the delegation — that structure is the expected answer.

### Q15. How does State handle illegal transitions and where should validation live?

Illegal transitions (insert a coin while dispensing, publish an already-published doc) are handled *by the state itself*: each state implements the response for *every* event, and for events that don't apply it does nothing, rejects, or throws. Because each state only implements its *own* legal behavior, illegal combinations become a no-op or explicit rejection *inside that state's method* — you never need a global "is this transition allowed?" check.

```java
class Published implements DocState {
    public void publish(Document ctx) {
        throw new IllegalStateException("already published");  // or silent no-op
    }
}
```

Two placements for transition/validation logic:

- **In the state objects** (decentralized): each state knows its valid next states. Adding a state is local; the context stays trivial. Cost: states reference each other, and the full transition map is spread across classes.
- **In the context or a transition table** (centralized): the context owns a `Map<State, Set<State>>` of allowed transitions and validates before switching. The whole FSM is visible in one place; cost is a growing context and a central spot that changes whenever states change.

For small machines, put it in the states. For large FSMs where *seeing the whole graph* matters (protocol state machines, workflow engines), a table-driven approach — enum states plus a transition table — is often clearer than dozens of state classes, and is a legitimate alternative to the object-per-state pattern.

### Q16. Refactor this state-conditional god method using the State pattern.

Before — every method branches on a status string, and a new status means editing all of them:

```java
class Order {
    String status;   // "NEW", "PAID", "SHIPPED", "DELIVERED"
    void pay() {
        if (status.equals("NEW")) status = "PAID";
        else if (status.equals("PAID")) throw new IllegalStateException("already paid");
        else throw new IllegalStateException("cannot pay in " + status);
    }
    void ship() {
        if (status.equals("PAID")) status = "SHIPPED";
        else throw new IllegalStateException("cannot ship in " + status);
    }
    // ...deliver(), cancel() — each a fresh switch on status
}
```

The smell: the *same* status branching duplicated across `pay`, `ship`, `deliver`, `cancel` — shotgun surgery when a `RETURNED` status appears. After — one class per state, transitions inside them:

```java
interface OrderState { void pay(Order o); void ship(Order o); }

class New implements OrderState {
    public void pay(Order o)  { o.setState(new Paid()); }
    public void ship(Order o) { throw new IllegalStateException("pay first"); }
}
class Paid implements OrderState {
    public void pay(Order o)  { throw new IllegalStateException("already paid"); }
    public void ship(Order o) { o.setState(new Shipped()); }
}
class Shipped implements OrderState {
    public void pay(Order o)  { throw new IllegalStateException("already paid"); }
    public void ship(Order o) { throw new IllegalStateException("already shipped"); }
}
class Order {
    private OrderState state = new New();
    void setState(OrderState s) { state = s; }
    void pay()  { state.pay(this); }
    void ship() { state.ship(this); }
}
```

Each method is now a one-line delegation; the branching became polymorphic dispatch. This is the "**replace conditional with polymorphism**" refactoring, and the State pattern is its canonical target when the conditional is on an object's own mode. Adding `RETURNED` = one new class + wiring, no edits to existing states — Open/Closed restored.

## Behavioral Patterns III: Iterator, Mediator, Visitor & Memento

### Summary

**What this topic covers**

The final behavioral group: **Iterator** (traverse a collection's elements sequentially without exposing its internal structure — the pattern your `for-each` loop is built on), **Mediator** (centralize complex many-to-many communication between objects into a single hub, so objects talk to the mediator instead of each other), **Visitor** (add new operations to a class hierarchy without modifying those classes, via double dispatch — and pay for it with the expression-problem tradeoff), and **Memento** (capture an object's internal state so it can be restored later, without breaking encapsulation — the state-snapshot behind undo). A brief look at **Interpreter** (represent a grammar's rules as a class hierarchy and evaluate sentences) rounds out the 23 GoF patterns. The 15 questions cover intent, structure, and code for each, plus the sharp comparisons — **Mediator vs Observer**, Visitor's double dispatch and its extensibility tradeoff, and how Memento partners with Command for undo.

**Mental model**

These four are about *decoupling a concern from the objects it touches*. **Iterator** decouples *traversal* from the collection: the collection exposes an iterator object that knows how to walk it, so clients loop uniformly over arrays, trees, and hash tables without knowing the internals — and multiple independent traversals can run at once. **Mediator** decouples *object-to-object communication*: instead of N objects each holding references to the others (N² coupling), they all reference one mediator that coordinates them, turning a mesh into a star. **Visitor** decouples *operations* from *the object structure they run on*: rather than adding a method to every class in a hierarchy for each new operation, you write one Visitor holding all the per-type logic and "visit" the structure — letting you add operations without touching the classes. **Memento** decouples *state capture* from the object's public interface: the object hands out an opaque snapshot only it can read, so a caretaker can save/restore state without the object exposing its internals. The unifying theme: pull a cross-cutting concern (traversal, communication, operations, snapshots) *out* of the objects.

**Key terms**

- **Iterator** — an object that provides sequential access to a collection's elements without revealing its representation.
- **Internal vs external iterator** — internal: the collection runs the loop and calls you back (`forEach`); external: the client controls advancement (`hasNext`/`next`).
- **Mediator** — a hub object that encapsulates how a set of objects (colleagues) interact.
- **Colleague** — an object that communicates through the mediator rather than directly with peers.
- **Visitor** — an object carrying an operation to perform on each element of an object structure.
- **Double dispatch** — selecting a method based on the runtime types of *two* objects (the element and the visitor).
- **Expression problem** — the tension between adding new types easily vs adding new operations easily; Visitor picks the latter.
- **Memento** — an opaque snapshot of an object's internal state.
- **Originator / Caretaker** — originator creates/restores mementos; caretaker stores them without inspecting them.
- **Interpreter** — a class-per-grammar-rule structure that evaluates sentences of a language.
- **Element `accept(visitor)`** — the hook that makes Visitor's double dispatch work.

**Why interviewers ask this**

Iterator seems trivial until you're asked *why* it exists — the answer (uniform traversal, hidden representation, multiple simultaneous walks, lazy/infinite sequences) reveals whether you understand encapsulation and iterator invalidation. Mediator vs Observer is a favorite discriminator: both reduce coupling, but Mediator *centralizes* control (a hub that knows the participants) while Observer *distributes* it (a subject broadcasting to anonymous listeners), and confusing them signals shallow pattern knowledge. Visitor is the deep-end question — it tests double dispatch (a concept many engineers have never articulated), the expression problem (a genuine design tradeoff, not a recipe), and honest judgment about when the machinery is worth it. Memento probes whether you can capture state *without breaking encapsulation* — the subtlety that separates a naive "just make the fields public" answer from a designed snapshot. Collectively they check breadth (you know all 23) and depth (you can reason about the awkward ones).

**Common confusions**

- **"Mediator and Observer are interchangeable"** — Mediator is a *hub coordinating known participants* (star topology, bidirectional); Observer is a *subject broadcasting to unknown listeners* (one-to-many, usually one-directional).
- **"Visitor lets you add anything easily"** — it makes adding *operations* easy but adding *new element types* hard (you must update every visitor). That's the expression-problem tradeoff.
- **"An Iterator is just an index"** — it's an object encapsulating *position and traversal strategy*, enabling trees, lazy streams, and multiple concurrent walks, not just array indexing.
- **"Memento means exposing the object's fields"** — the whole point is the snapshot is *opaque* to everyone but the originator; encapsulation is preserved.
- **"Visitor's double dispatch is just an if-instanceof chain"** — a type switch is the anti-pattern Visitor replaces; double dispatch resolves the type via polymorphism (`accept`/`visit`), not runtime type checks.

**What follows from this topic**

This closes the behavioral patterns and, with the creational and structural topics, the full GoF catalog. Iterator connects to Composite (Structural) — you often iterate a Composite tree, frequently with a Visitor. Visitor is commonly applied *to* a Composite (walking an AST or file tree). Memento is the state-capture half of the undo story whose command half lives in Behavioral I. Mediator generalizes the coupling-reduction theme shared with Observer and Facade. From here the natural next steps are anti-patterns/refactoring (where over-applying these patterns becomes a smell) and LLD case studies (where you combine them to model a whole system).

### Q1. What problem does the Iterator pattern solve?

**Intent:** provide a way to access the elements of an aggregate object sequentially without exposing its underlying representation.

The problem: clients need to traverse a collection, but if they must know *how* it's stored (array indices, linked-list nodes, tree children, hash buckets), they're coupled to its internals — and different collections need different loop code. Iterator extracts traversal into a separate object with a uniform interface (`hasNext()` / `next()`), so a client walks *any* collection the same way and the collection is free to change its internal structure.

```text
+----------------+  creates  +-----------------+  <<interface>>
|  Aggregate     |---------->|   Iterator      |
+----------------+           +-----------------+
| + iterator()   |           | + hasNext():bool|
+----------------+           | + next(): T     |
        ^                    +-----------------+
        | <|..                       ^ <|..
+----------------+          +--------------------+
| ConcreteList   |          | ConcreteIterator   |
| + iterator() --+--------->| - position         |
+----------------+          +--------------------+
```

Benefits beyond uniformity: **multiple simultaneous traversals** (each iterator holds its own position), **hidden representation** (swap array for tree, clients unchanged), **lazy/infinite sequences** (an iterator can compute elements on demand — Python generators, Java `Stream`), and a **single-responsibility** split (the collection stores; the iterator traverses).

### Q2. Show internal vs external iterators and explain the tradeoff.

**External iterator** — the client controls advancement, calling `next()` explicitly:

```java
Iterator<String> it = list.iterator();
while (it.hasNext()) {              // client drives the loop
    String s = it.next();
    if (s.isEmpty()) break;        // client can stop, skip, or combine iterators
}
```

**Internal iterator** — the collection controls the loop and calls the client back per element:

```java
list.forEach(s -> process(s));     // collection drives; client supplies the body
```

```python
# Python: __iter__ returns an external iterator; but generators invert control
def walk(tree):
    for node in tree:              # external, driven by the for-loop
        yield node.value           # internal-ish: generator yields lazily
```

| | External (`hasNext`/`next`) | Internal (`forEach`/callback) |
|---|---|---|
| Who drives | Client | The collection |
| Early exit | Easy (`break`) | Awkward (need exceptions or a boolean return) |
| Combine two collections | Easy (advance both) | Hard |
| Encapsulation of traversal | Client sees the mechanism | Fully hidden |
| Conciseness | More boilerplate | Terser |

External iterators are more flexible (early exit, zip/merge two iterators, pause mid-stream); internal iterators are terser and hide traversal entirely but make early termination and multi-collection coordination clumsy. Most languages offer both — Java's `Iterator` (external) and `forEach`/`Stream` (internal); Python's `for` over `__iter__` plus generators for laziness.

### Q3. What is iterator invalidation and how do languages handle it?

**Iterator invalidation** happens when a collection is *structurally modified* (add/remove) while an iterator over it is live — the iterator's cached position no longer matches the collection, risking skipped elements, double-visits, or crashes.

Java uses **fail-fast** iterators: the collection tracks a `modCount`, and if it changes during iteration (except via the iterator's own `remove()`), the next `next()` throws `ConcurrentModificationException` — failing loudly rather than corrupting silently.

```java
for (String s : list) {
    if (s.isEmpty()) list.remove(s);   // ConcurrentModificationException
}
// Correct: mutate through the iterator
Iterator<String> it = list.iterator();
while (it.hasNext()) {
    if (it.next().isEmpty()) it.remove();   // safe
}
```

Other strategies: **fail-safe / snapshot** iterators (`CopyOnWriteArrayList`, `ConcurrentHashMap`) iterate over a copy or tolerate concurrent change, never throwing but possibly not reflecting the latest state; C++ iterators are invalidated by certain container operations and using them is undefined behavior (the burden is on the programmer). The design lesson: an iterator holds a *reference to the collection's structure*, so its validity is tied to that structure's stability — a subtle coupling the pattern otherwise hides.

### Q4. What problem does the Mediator pattern solve, and what is its structure?

**Intent:** define an object that encapsulates how a set of objects interact, promoting loose coupling by keeping objects from referring to each other explicitly.

The problem is **many-to-many coupling**. When a set of objects all communicate directly, each holds references to many others — a dialog where the checkbox enables a text field, the text field validates against a dropdown, the dropdown resets the button. Every widget knows every other widget; the interaction logic is smeared across all of them, and reuse is impossible because each is entangled with specific peers. Mediator inserts a hub: each colleague talks only to the mediator, which contains the coordination logic. The mesh becomes a star.

```text
Before (mesh):            After (star, via Mediator):
 A --- B                    A     B
 | \ / |                     \   /
 |  X  |                      Mediator
 | / \ |                     /   \
 C --- D                    C     D
```

```text
+----------------+          +-------------------+  <<interface>>
|  Colleague     |--------->|    Mediator       |
+----------------+  notifies+-------------------+
| - mediator     |          | + notify(sender,  |
| + changed()    |          |          event)   |
+----------------+          +-------------------+
                                     ^ <|..
                            +--------------------+
                            | DialogMediator     |
                            | coordinates widgets|
                            +--------------------+
```

Adding an interaction rule means editing *one* place (the mediator), not rewiring the colleagues. The colleagues become reusable because they're no longer coupled to specific peers.

### Q5. Show a Mediator example and name its main risk.

```java
interface Mediator { void notify(Component sender, String event); }

abstract class Component {
    protected Mediator mediator;
    Component(Mediator m) { this.mediator = m; }
}
class Checkbox extends Component {
    boolean checked;
    Checkbox(Mediator m) { super(m); }
    void toggle() { checked = !checked; mediator.notify(this, "toggled"); }
}
class TextField extends Component {
    boolean enabled;
    TextField(Mediator m) { super(m); }
    void setEnabled(boolean e) { enabled = e; }
}

class FormMediator implements Mediator {
    private Checkbox agreeBox;
    private TextField signature;
    // ...setters wire the colleagues
    public void notify(Component sender, String event) {
        if (sender == agreeBox && event.equals("toggled")) {
            signature.setEnabled(agreeBox.checked);   // coordination lives here
        }
    }
}
```

The colleagues (`Checkbox`, `TextField`) know *nothing* about each other — only the mediator. Add "when the box is checked, also focus the signature field" by editing `FormMediator` alone.

**Main risk:** the mediator becomes a **God object**. All coordination logic centralizes there, so as the system grows the mediator swells into an unmaintainable blob that knows everything. You've traded distributed coupling for a central complexity magnet. Mitigate by keeping mediators *scoped* (one per dialog/subsystem, not one global mediator) and moving genuinely local logic back into colleagues. The pattern reduces coupling *between colleagues* at the cost of concentrating it *in the hub* — a good trade only when the interaction web is genuinely complex.

### Q6. Mediator vs Observer — how do they differ?

Both reduce coupling by inserting an intermediary, so they're a common discriminator question. The difference is *topology and control*.

| | Mediator | Observer |
|---|---|---|
| Topology | Star — a hub coordinating known colleagues | One-to-many — a subject broadcasting to observers |
| Direction | Bidirectional — colleagues both send to and receive from the hub | Usually one-way — subject → observers |
| Does the hub know participants? | Yes — the mediator holds and coordinates specific colleagues | The subject holds a list but treats observers anonymously |
| Contains logic? | Yes — coordination/business logic lives in the mediator | No — the subject just notifies; it holds no interaction logic |
| Intent | Centralize *how a set of objects interact* | Broadcast *state changes to interested parties* |
| Coupling shape | Colleagues ↔ mediator ↔ colleagues | Subject → many observers |

The crisp version: **Observer broadcasts** — a subject fires an event and anonymous listeners react, with the coordination logic *distributed* across observers. **Mediator coordinates** — a hub knows the participants and *contains* the logic that routes their interactions, which are typically bidirectional. Observer is about *notification* (one source, many reactors); Mediator is about *orchestration* (many peers, one coordinator). They're often combined: colleagues notify the mediator via an Observer-style event, and the mediator holds the coordination logic. If the intermediary contains interaction *rules*, it's a Mediator; if it just *forwards notifications*, it's Observer/pub-sub.

### Q7. What problem does the Visitor pattern solve, and what is its structure?

**Intent:** represent an operation to be performed on the elements of an object structure, letting you define a new operation without changing the classes of the elements it operates on.

The problem: you have a stable class hierarchy (AST nodes, shapes, file-system entries) and you keep needing *new operations* over it — render, export, calculate area, type-check, pretty-print. Adding each operation as a method means editing *every* class in the hierarchy for *every* new operation — an Open/Closed violation, and it scatters one logical operation (e.g. "export to XML") across all the classes. Visitor gathers each operation into *one* visitor class holding a `visit` method per element type, and each element gains an `accept(visitor)` that dispatches to the right one.

```text
+----------------+  accept(v) +-----------------+  <<interface>>
|  Element       |----------->|   Visitor       |
+----------------+            +-----------------+
| + accept(v)    |            | + visitCircle(c)|
+----------------+            | + visitSquare(s)|
        ^ <|..                +-----------------+
   +----+-----+                      ^ <|..
+--------+ +--------+       +--------------------+
| Circle | | Square |       | AreaVisitor        |
| accept | | accept |       | ExportVisitor      |
+--------+ +--------+       +--------------------+
```

Now "add an operation" = write one new visitor, zero edits to `Circle`/`Square`. The operation's logic for all types lives together in the visitor, which is easier to read and maintain than the same logic scattered across the element classes.

### Q8. Explain double dispatch and why Visitor needs it.

**Double dispatch** means selecting which method runs based on the runtime types of *two* objects. Most OO languages have only *single* dispatch — a call `x.foo()` picks the method by the runtime type of `x` alone. But Visitor needs to pick behavior by *both* the element type (Circle vs Square) *and* the visitor type (Area vs Export). Two axes, single-dispatch language — that's the problem Visitor solves with a two-step polymorphic bounce.

```java
interface Shape { <R> R accept(Visitor<R> v); }

class Circle implements Shape {
    double radius;
    public <R> R accept(Visitor<R> v) { return v.visitCircle(this); }  // dispatch 1: on Shape
}
class Square implements Shape {
    double side;
    public <R> R accept(Visitor<R> v) { return v.visitSquare(this); }  // dispatch 1: on Shape
}

interface Visitor<R> { R visitCircle(Circle c); R visitSquare(Square s); }

class AreaVisitor implements Visitor<Double> {
    public Double visitCircle(Circle c) { return Math.PI * c.radius * c.radius; }
    public Double visitSquare(Square s) { return s.side * s.side; }
}

// Usage:
double a = someShape.accept(new AreaVisitor());
```

The two dispatches: (1) `shape.accept(v)` resolves on the *shape's* runtime type → calls `Circle.accept`, which (2) calls `v.visitCircle(this)`, resolving on the *visitor's* runtime type. The combination of the two virtual calls picks the exact `(shape, visitor)` behavior — *without* any `instanceof` checks. That double bounce through `accept` is the mechanical heart of Visitor; replace it with an `if (shape instanceof Circle)` type-switch and you've thrown away the polymorphism the pattern exists to provide.

### Q9. What is the expression problem, and what tradeoff does Visitor make?

The **expression problem** is the fundamental tension: you have *types* (Circle, Square) and *operations* (area, export), forming a grid. You can make it easy to add rows *or* columns, but not both, without modifying existing code.

- **Standard OO (methods on classes)** makes adding a **new type** easy — write one new class implementing all operations — but adding a **new operation** hard: you edit every existing class.
- **Visitor inverts this**: adding a **new operation** is easy (one new visitor, no element changes) — but adding a **new element type** is *hard*: you must add a `visit` method to *every existing visitor* and they won't compile until you do.

| | Add new *type* | Add new *operation* |
|---|---|---|
| Methods on classes (normal OO) | Easy (1 class) | Hard (edit all classes) |
| Visitor | Hard (edit all visitors) | Easy (1 visitor) |

So the decision rule: **use Visitor when the set of types is stable but operations grow** (a compiler's fixed AST nodes with ever-more passes: type-check, optimize, codegen). **Avoid Visitor when the types change often** — you'll pay the "touch every visitor" tax constantly. This is why Visitor is beloved in compilers and interpreters (stable grammar, many passes) and disliked in domains where the type hierarchy keeps evolving. Being honest about this tradeoff — rather than presenting Visitor as universally good — is the senior signal.

### Q10. When should you NOT use Visitor?

Visitor is the GoF pattern with the *worst* cost/benefit ratio when misapplied. Avoid it when:

- **The element hierarchy changes often**: every new element type forces edits to every visitor (Q9). If types are unstable, Visitor is a maintenance tax.
- **There are few operations, or operations rarely get added**: the whole machinery (accept methods, a visitor interface per operation) only pays off when you keep adding operations. One or two operations? Just put methods on the classes.
- **You'd break encapsulation to make it work**: visitors need access to element internals, often forcing public getters or a widened interface, leaking state the class should hide.
- **The double dispatch confuses the team**: Visitor's indirection (why does `accept` call back into `visit`?) has a real readability cost; on a team unfamiliar with it, a simple pattern-matched `switch` (in languages with sealed types / pattern matching — Rust `match`, Scala, Java sealed classes + switch) can be clearer and gives similar "operations separate from data" benefits without the boilerplate.

Modern languages with **sealed hierarchies and exhaustive pattern matching** (Java 21 switch on sealed types, Kotlin `when`, Rust enums) often obsolete classic Visitor: you get compile-time exhaustiveness and add operations freely, while the compiler forces you to handle every type. Reach for Visitor mainly in older OO languages without those features, over a genuinely stable hierarchy with many operations.

### Q11. What problem does the Memento pattern solve, and what is its structure?

**Intent:** capture and externalize an object's internal state — without violating encapsulation — so the object can be restored to this state later.

The problem: you need snapshots (undo, checkpoints, transactions, save games) but the state you must capture is *private*. The naive fix — make the fields public or add getters/setters for everything — destroys encapsulation and lets anyone corrupt the object. Memento solves it with three roles: the **Originator** (the object whose state is saved) creates a **Memento** (an opaque snapshot) and can restore from one; the **Caretaker** (e.g. an undo stack) *holds* mementos but *cannot read or modify* them. Only the originator can open its own memento.

```text
+----------------+  creates  +--------------+   stored in   +-------------+
|  Originator    |---------->|   Memento    |<--------------| Caretaker   |
+----------------+           +--------------+   (opaque)    | (undo stack)|
| - state        |  restore  | - state      |               +-------------+
| + save():Memento|<---------| (private to  |
| + restore(m)   |           |  Originator) |
+----------------+           +--------------+
```

```java
class Editor {                              // Originator
    private String content;
    Memento save() { return new Memento(content); }        // snapshot private state
    void restore(Memento m) { this.content = m.state; }

    static final class Memento {            // opaque to everyone but Editor
        private final String state;
        private Memento(String s) { this.state = s; }
    }
}
class History {                             // Caretaker
    private final Deque<Editor.Memento> stack = new ArrayDeque<>();
    void push(Editor.Memento m) { stack.push(m); }   // holds it, can't read it
    Editor.Memento pop() { return stack.pop(); }
}
```

The `Memento`'s fields are private and only `Editor` can construct/read them, so the caretaker stores snapshots blindly — encapsulation intact.

### Q12. How do Memento and Command combine for undo, and how do you manage memory?

They're complementary halves of undo. **Command** captures *what action to reverse*; **Memento** captures *the state to reverse to*. A command that's hard to invert computationally stores a memento of the pre-execution state and restores it on `undo()`:

```java
class EditCommand implements Command {
    private final Editor editor;
    private Editor.Memento before;
    EditCommand(Editor e) { this.editor = e; }
    public void execute() { before = editor.save(); editor.applyEdit(); }  // snapshot first
    public void undo()    { editor.restore(before); }                      // roll back
}
```

Two undo strategies: **command-based** (store the *inverse operation* — cheap, exact, but needs every command to be invertible) vs **memento-based** (store *state snapshots* — works for any operation, but costs memory). Use mementos when operations are lossy or awkward to invert (a "sort" or "auto-format" has no clean inverse).

**Memory management** matters because snapshots add up:

- **Bound the history**: cap the undo stack (e.g. last 50 states); drop the oldest.
- **Store deltas, not full snapshots**: capture only what changed since the last memento, not the whole object — a big win for large state.
- **Incremental / copy-on-write**: share unchanged structure between snapshots (persistent data structures) so each memento is cheap.
- **Serialize cold history**: keep recent mementos in memory, spill older ones to disk.

The naive "full deep copy per keystroke" is what interviewers want you to *improve on* — mention deltas or bounded history.

### Q13. Doesn't Memento break encapsulation? How is it preserved across languages?

The apparent paradox: to save private state, *something* outside the object must hold it. Memento preserves encapsulation by ensuring the holder (caretaker) gets an **opaque token** it can't inspect, while only the originator can read/write the memento's contents. The state leaves the object, but *access* to it doesn't.

Languages enforce the opacity differently:

- **Java**: make `Memento` a `static` nested class of the originator with `private` fields — nested classes can access each other's privates, so the originator reads the memento, but external code (the caretaker) sees only an opaque reference. Or expose a *narrow* public interface (`Memento` marker) to the caretaker and a *wide* interface to the originator.
- **C++**: the originator declares the memento a `friend` (or nests it), so only the originator touches its internals.
- **Python/TypeScript**: no true privacy, so it's *by convention* — the memento is treated as opaque (leading underscore, `__` name-mangling in Python), or you close over the state so nothing external can reach it.

The design principle stands regardless of language enforcement: the **caretaker stores, the originator interprets**. If the caretaker can read the state, you've reduced Memento to "expose your fields," and lost the pattern's entire reason for existing.

### Q14. Briefly, what is the Interpreter pattern and when is it (rarely) used?

**Intent:** given a language, define a representation for its grammar along with an interpreter that uses the representation to evaluate sentences in the language.

Each grammar rule becomes a class; a sentence becomes a tree of these objects (an AST), and evaluation is a recursive `interpret()` call down the tree. It's essentially Composite (Structural) applied to a grammar, often paired with Visitor for evaluation.

```java
interface Expr { int interpret(Map<String,Integer> ctx); }
class Num implements Expr {
    int value; public int interpret(Map<String,Integer> c){ return value; }
}
class Add implements Expr {
    Expr left, right;
    public int interpret(Map<String,Integer> c){ return left.interpret(c) + right.interpret(c); }
}
// (2 + 3): new Add(new Num(2), new Num(3)).interpret(ctx) -> 5
```

**When it's used — rarely.** Interpreter fits *small, stable, simple* grammars: a boolean rule engine, a query filter DSL, arithmetic expressions, a template language, regex-like matchers. **When to avoid it — usually.** For any non-trivial or performance-sensitive language, a class-per-rule tree is slow and unwieldy; you use a real parser generator (ANTLR, yacc) and often compile rather than tree-walk. In interviews it's the least-asked GoF pattern; know it exists, know it's Composite-over-a-grammar, and know that a hand-rolled Interpreter is a red flag for anything beyond a tiny DSL.

### Q15. Design an undo/redo system for a drawing app. Which patterns, and how do they fit together?

Requirements: draw/move/delete shapes on a canvas, with unlimited undo and redo. This is a multi-pattern LLD answer combining Command, Memento, and often Iterator.

**Command** for each user action (reifies "what happened" so it's storable and reversible):

```java
interface Command { void execute(); void undo(); }
class AddShapeCommand implements Command {
    private final Canvas canvas; private final Shape shape;
    AddShapeCommand(Canvas c, Shape s){ canvas=c; shape=s; }
    public void execute(){ canvas.add(shape); }
    public void undo(){ canvas.remove(shape); }        // cleanly invertible -> no memento needed
}
class MoveShapeCommand implements Command {
    private final Shape shape; private Point before, after;
    public void execute(){ before = shape.position(); shape.moveTo(after); }
    public void undo(){ shape.moveTo(before); }         // stores just the delta
}
```

**Memento** where an action *isn't* cleanly invertible (a "flatten layers" or "apply filter" op): the command snapshots the affected state and restores it on undo (Q12). Store *deltas or bounded history*, not a full-canvas copy per action (Q12 memory notes).

**The undo/redo manager** holds two stacks (Behavioral I, Q11): `execute` pushes onto the undo stack and clears redo; `undo` pops, calls `undo()`, pushes to redo; `redo` reverses that. **Iterator** appears for rendering — the canvas exposes an iterator so the renderer walks shapes without knowing they're stored in a list, tree, or spatial index, and can be swapped for a z-order or region-based traversal later.

So the layered answer: **Command** makes actions first-class and reversible, **Memento** handles the non-invertible ones without exposing shape internals, two **stacks** give redo, and **Iterator** decouples rendering from storage. Naming *which pattern does which job* — rather than "I'd use the Command pattern" — is what distinguishes a senior LLD answer.
## Pattern Selection & Anti-Patterns

### Summary

**What this topic covers**

How to actually *use* the pattern catalog in practice — and, just as importantly, when not to. The previous topics taught you the 23 Gang-of-Four patterns individually; this topic is about judgment. It covers (1) **selection** — how to go from a problem to a pattern rather than shopping for a pattern to apply; (2) **patterns as shared vocabulary** — the real reason the GoF book mattered; (3) **overuse** — "patternitis", speculative generality, and the cost of premature abstraction; and (4) **anti-patterns** — the recurring bad solutions that have their own names: God object, spaghetti code, golden hammer, lava flow, magic numbers, poltergeist, and the yo-yo problem. The 16 questions here are the difference between a candidate who can recite Strategy and one who knows that most "Strategy vs State" debates are answered by looking at who triggers the transition. If you take one thing away: a pattern is a *response to a force in the problem*, and if the force isn't there, neither should the pattern be.

**Mental model**

Think of patterns as **named solutions to recurring design tensions**, not as building blocks you assemble a system from. Every pattern exists to resolve a specific *force*: Strategy resolves "this algorithm varies at runtime"; Observer resolves "N objects must react to one object's change without it knowing them"; Decorator resolves "I need to add responsibilities to individual objects, not a whole class." The correct workflow is **problem → force → pattern**, never **pattern → let me find somewhere to use it**. When you feel a design pain (a `switch` that keeps growing, a class that changes for six unrelated reasons, duplicated conditional logic), *that pain names the pattern*. Absent the pain, adding the pattern is pure cost: more indirection, more classes, more cognitive load, and a reader who now has to understand machinery that buys nothing. The senior instinct is subtractive — the best design is often the one with the fewest moving parts that still absorbs the change you can *actually see coming*, not the change you're imagining.

**Key terms**

- **Design force** — a constraint or pressure in the problem (varying algorithm, unknown number of subclasses, cross-cutting concern) that a pattern is built to resolve.
- **Patternitis** — compulsively applying patterns where plain code would do; symptom of learning patterns before learning problems.
- **Premature abstraction** — introducing a generalization (interface, plugin point, factory) before you have two real cases that need it. Cousin of speculative generality.
- **Speculative generality** — machinery built for a future requirement that never arrives; a code smell (Fowler).
- **Golden hammer** — "when all you have is a hammer, everything looks like a nail"; reaching for one familiar tool/pattern for every problem.
- **God object / blob** — one class that knows and does too much; the anti-pattern opposite of Single Responsibility.
- **Spaghetti code** — control flow so tangled (deep nesting, gotos, hidden globals) that you cannot follow a path through it.
- **Lava flow** — dead or mystery code nobody dares delete, frozen in place like cooled lava.
- **Magic number** — an unexplained literal (`if (status == 7)`) instead of a named constant.
- **Poltergeist** — a class with no real responsibility that only shuttles data or kicks off other objects, then vanishes.
- **Yo-yo problem** — an inheritance hierarchy so deep you must "yo-yo" up and down many classes to understand one behavior.

**Why interviewers ask this**

Reciting patterns is a junior signal; *choosing* them is a senior one. Interviewers use pattern-selection questions to find candidates who over-engineer, because those candidates ship codebases that are hard to change despite (or because of) their cleverness. When you say "I'd add a factory here," a good interviewer immediately asks "why — what varies?" A junior answers "so it's flexible"; a senior answers "nothing varies yet, so I'd use a plain constructor and extract a factory the day a second product type appears." The willingness to say **"no pattern"** is exactly the signal they want. Anti-pattern questions ("you inherit a God class — what do you do?") test whether you can diagnose and *incrementally* fix real legacy code without a rewrite, which is most of the actual job.

**Common confusions**

- "More patterns = better design." No — every pattern is indirection, and indirection is only worth it when it absorbs real, present variation.
- "Patterns make code flexible." They make code flexible *along one axis*. Add flexibility on the wrong axis and you've added cost with no benefit.
- "An anti-pattern is just a bug." No — an anti-pattern is a *structural* bad solution that looks reasonable and recurs; it's about shape, not correctness.
- "If I might need it later, abstract now." YAGNI: the cost of the wrong abstraction usually exceeds the cost of adding it later when you know the real shape.
- "Singleton is a design pattern, so it's fine." It's in the book, but it's widely treated as an anti-pattern (global state, hidden coupling, hard to test).

**What follows from this topic**

This topic is the bridge between knowing patterns and refactoring real systems. The anti-patterns here — God object, magic numbers, deep hierarchies — are the *destinations* you refactor *away from* in **Code Smells & Refactoring**, and the discipline of "abstract only what varies" feeds directly into **Domain Modeling & Abstraction**, where choosing the right altitude is the whole game. If you internalize "problem → force → pattern," the rest of OOD becomes editing rather than decorating.

### Q1. How do you decide which design pattern to use for a problem?

Work **problem → force → pattern**, never the reverse. Start by naming the *pressure* in the design:

- "An algorithm varies at runtime and I want to swap it" → **Strategy**.
- "Behavior depends on an internal mode, and transitions between modes are part of the logic" → **State**.
- "Many objects must react when one changes, and it shouldn't know who they are" → **Observer**.
- "I need to add responsibilities to individual objects without subclassing an explosion" → **Decorator**.
- "Object creation is complex or the concrete type is chosen at runtime" → **Factory Method / Abstract Factory**.
- "I need to treat individual objects and compositions of them uniformly" → **Composite**.

If you can't name a force, you don't have a pattern — you have a plain class or function. Say that out loud in an interview. The strongest answer is often: "I'd start with the simplest thing — a method with a conditional — and extract a pattern the moment a *second* real case forces it." That signals you optimize for the change you can see, not the one you're imagining.

### Q2. What does it mean that design patterns are a shared vocabulary?

The most underrated value of the GoF book isn't the code — it's the *names*. When you say "I made `PaymentProcessor` a Strategy so we can register new providers," an experienced teammate instantly knows the structure (an interface, interchangeable implementations, a context that holds a reference) without reading a line. Patterns compress a paragraph of design intent into one word.

That's why *communicating* in patterns matters even when the code is trivial. "This is just an Observer" tells a reviewer where to look for the coupling and how change will propagate. It also sets expectations: if you call something a Singleton, readers assume global access and one instance, and will be surprised (correctly) if it isn't.

Two cautions. First, use the name only when the structure actually matches — mislabeling a "Manager class" as a Facade misleads. Second, vocabulary is for humans; it's not a reason to *introduce* a pattern. Naming a thing you already have is free; building a thing so you can name it is patternitis.

### Q3. What is "patternitis" / pattern overuse, and how do you spot it?

**Patternitis** is applying patterns because you know them, not because the problem demands them. It's the classic failure mode of an engineer who just read the GoF book. Symptoms:

- An `AbstractFactoryBuilderStrategyManager` where a two-line function would do.
- Interfaces with exactly one implementation and no realistic second one coming.
- A factory that only ever constructs one concrete class.
- Layers of indirection you must trace through to answer "what actually happens when I call this?"

The tell is the **1:1 ratio** — one interface, one implementation, one caller — with no variation in sight. Every pattern is a trade: it buys flexibility on some axis and pays in classes, files, indirection, and reader effort. Patternitis is paying the price and receiving nothing.

The cure is YAGNI plus "**refactor to** patterns, don't **design to** them" (Kerievsky). Write the simplest code that works; when duplication or a growing conditional *reveals* the axis of change, extract the pattern then, with the real shape in hand.

### Q4. When is the right answer no pattern at all?

Often — and saying so is a senior signal. Use no pattern when:

- **There's no variation.** One payment provider, one export format, one algorithm. A plain method or class is clearer than a Strategy with one strategy.
- **The abstraction is speculative.** You *imagine* future providers but have zero concrete second cases. Wait for the second case; it'll tell you the real interface.
- **The pattern hides more than it reveals.** If a reader must jump through three files to understand a five-line operation, the indirection is a net loss.
- **A language feature already solves it.** First-class functions replace many Strategy/Command uses; an enum replaces some State; a `with` block / RAII / `try-with-resources` replaces some Template Method scaffolding.

```java
// Over-engineered: Strategy with a single strategy and no second case in sight
interface DiscountStrategy { BigDecimal apply(BigDecimal p); }
class NoDiscount implements DiscountStrategy { public BigDecimal apply(BigDecimal p){ return p; } }
// vs. what the problem actually needs today:
BigDecimal price = order.total(); // just compute it
```

The rule: **the simplest design that absorbs the change you can actually see.** Add the pattern the day the second case is real.

### Q5. What is premature abstraction and why is it costly?

Premature abstraction is introducing a generalization — an interface, a base class, a plugin point, a factory — before you have two or more real cases that share a shape. It's costly for a subtle reason: **the wrong abstraction is more expensive than duplication.**

When you abstract from a single example, you're guessing at the axis of variation. The guess is usually wrong, so when the *second* real case arrives it doesn't fit the interface you invented, and now you must either contort the case to fit or rework the abstraction while callers depend on it. Sandi Metz's rule of thumb: **"duplication is far cheaper than the wrong abstraction."** Inlining duplicated code back out is mechanical; unwinding a bad abstraction that everything depends on is surgery.

The discipline: tolerate a little duplication until the *third* occurrence (the "rule of three"), by which point you can see what genuinely varies and what's stable, and extract an abstraction that fits reality instead of a forecast. This is the same instinct as YAGNI, applied to structure rather than features.

### Q6. What is the God Object / God Class anti-pattern, and how do you fix it?

A **God Object** is a single class that knows too much and does too much — it holds most of the system's state and orchestrates most of its behavior, so every change touches it. It's the structural opposite of Single Responsibility and the natural endpoint of "just add it to `Manager`."

Signs: thousands of lines, dozens of fields, methods that operate on unrelated concerns, and a class name like `Manager`, `Processor`, `Utils`, or `System` that resists a one-sentence description of its job.

Fix it **incrementally**, not with a rewrite:

```text
GodOrderManager                 Order          Payment
+ validate()          -->       + validate()   + charge()
+ calcTax()                     Pricing        Shipping
+ charge()            ==>       + calcTax()    + schedule()
+ ship()                        Notifier
+ email()                       + email()
+ everything...
```

1. **Identify clusters** of methods+fields that change together (a hidden responsibility).
2. **Extract class** for each cluster (Pricing, Payment, Shipping, Notifier).
3. Have the former God class **delegate** to the new collaborators, then thin it out or delete it.
4. Lean on tests at each step (Tidy First — small, safe, reversible moves).

The heuristic that drives the split is **cohesion**: methods that touch the same fields belong together; fields no method shares belong elsewhere.

### Q7. What is spaghetti code and what causes it?

**Spaghetti code** is control flow so tangled you cannot trace a single path through it: deep nesting, long methods, `goto`-style jumps, hidden mutation of shared/global state, and functions that reach across the whole program. The name captures the experience of trying to follow one strand.

Causes are almost always *organic*, not malicious: features bolted on under deadline, conditionals added rather than refactored, no clear ownership of state, and copy-paste instead of extraction. Each individual change was reasonable; the accumulation is chaos.

The antidotes are structural: **guard clauses** to flatten nesting, **extract method** to name sub-steps, **encapsulate state** so mutation happens in one place, and clear module boundaries so control doesn't leap across the codebase. In OOD terms, spaghetti is what you get from low cohesion and high coupling; the fix is the reverse — small classes with clear responsibilities that talk through narrow interfaces (Law of Demeter: don't reach through object graphs).

### Q8. What is the golden hammer anti-pattern?

The **golden hammer** is over-relying on one familiar tool, technology, or pattern for every problem — "when all you have is a hammer, everything looks like a nail." The engineer who solves *everything* with inheritance, or wraps every class in a Singleton, or models every workflow as a state machine, is swinging a golden hammer.

It's insidious because within its comfort zone the tool genuinely works, which reinforces the habit. The cost shows up at the edges, where the tool is a poor fit and gets bent to shape: a Singleton used as a global variable store, inheritance used for code reuse where composition fit better, an ORM forced onto a problem that wanted raw SQL.

The cure is a broad enough toolkit that you *have* choices, plus the discipline to match tool to force (see Q1). In interviews, the golden-hammer tell is answering every design question with the same pattern; the counter-signal is naming trade-offs and sometimes rejecting your own first instinct: "I reach for inheritance here, but composition avoids the fragile base class, so I'd use composition."

### Q9. What is the lava flow anti-pattern?

**Lava flow** is dead or barely-understood code that hardened into the codebase because nobody dares remove it. Like cooled lava, it's rigid, ugly, and permanent: commented-out blocks, unused methods, mystery config flags, "temporary" code paths from a migration years ago, features behind flags no one has flipped since.

It accumulates when code ships fast without cleanup, ownership churns, and no one is confident that deleting a chunk is safe — so the safe move is always to leave it and route *around* it, which adds more flow on top.

The fix is **dead code elimination** backed by evidence: use coverage tools and logging/telemetry to prove a path is truly unreached, then delete it (version control is your undo). Prevention is cultural: strong tests so deletion is safe, code review that catches "leave this just in case," and the Tidy First habit of removing cruft in the same PR that touches nearby code. The worst response is the opposite — *preserving* lava out of superstition, which is how it forms in the first place.

### Q10. What is the magic number anti-pattern and how do you fix it?

A **magic number** (or magic string) is an unexplained literal buried in logic — `if (status == 7)`, `salary * 1.08`, `retryAfter(30000)`. The reader has no way to know what `7` means, whether `1.08` is tax or a raise, or that `30000` is milliseconds. Worse, the same value often appears in several places, so changing it means a risky find-and-replace.

The fix is a **named constant** (or enum) that encodes intent:

```java
// Before
if (order.status == 7) applyRefund(order);
double gross = base * 1.08;

// After
static final int STATUS_CANCELLED = 7;        // better: an enum
static final BigDecimal SALES_TAX = new BigDecimal("0.08");

if (order.status == STATUS_CANCELLED) applyRefund(order);
BigDecimal gross = base.multiply(BigDecimal.ONE.add(SALES_TAX));
```

Even better, replace the integer status with an `enum Status { OPEN, PAID, CANCELLED }` so the type system prevents nonsense values. Naming the literal does three things: documents intent at the use site, gives you a single point of change, and makes typos into compile errors. The only literals that stay bare are the truly self-evident ones (`0`, `1`, and arguably `-1`).

### Q11. What is the poltergeist anti-pattern?

A **poltergeist** (or "gypsy" class) is a class with no meaningful responsibility of its own — it briefly appears to shuttle data between other objects or to kick off a process, then disappears. Names like `OrderManagerController`, `DataMover`, `ProcessStarter`, or anything whose only methods are "call this, then call that."

It's a smell because it adds a node to the object graph that carries no state and encapsulates no rule; it's pure indirection. You have to understand the poltergeist *and* everything it delegates to, which is strictly more than understanding the delegates directly.

The fix is usually to **collapse it**: move its coordinating logic into an object that already owns the relevant data (Information Expert / GRASP), or replace it with a plain method call. If real coordination logic exists, it may deserve to be a genuine **Controller** or **Mediator** — but that's a class with actual responsibility, not a hollow relay. The distinction: a Mediator *owns* the interaction rules; a poltergeist just forwards.

### Q12. What is the yo-yo problem in inheritance hierarchies?

The **yo-yo problem** is having to scroll up and down a deep inheritance chain — "yo-yoing" between many classes — to understand a single behavior, because the logic for one operation is smeared across five or six levels of overrides, `super` calls, and template methods.

```text
Animal            <-- defines move(), calls step()
  Mammal          <-- overrides step(), calls stride()
    Quadruped     <-- overrides stride(), calls limb()
      Dog         <-- overrides limb()
        Puppy     <-- overrides move() again...
```

To answer "what does `puppy.move()` do?" you must read all five classes and mentally reconstruct the dispatch. This is fragile-base-class territory: a change high in the hierarchy silently alters behavior far below.

The fix is usually **composition over inheritance** — model the varying behavior as a collaborator (Strategy) that a shallow class holds, so behavior is *in one place* rather than scattered across a lineage. Keep hierarchies shallow (2–3 levels) and reserve inheritance for true "is-a substitutability" (LSP), not code reuse. If you find yourself yo-yoing, the hierarchy is doing a job that delegation would do more legibly.

### Q13. How do you know whether you've over-engineered a design?

Ask what each abstraction *buys* against what it *costs*, right now:

- **Interfaces with one implementation** and no concrete second case coming → likely speculative.
- **Indirection you can't justify with a present force** — "why is there a factory?" "…flexibility" is not an answer; "we construct three provider types chosen by config" is.
- **Reader effort exceeds problem difficulty** — if understanding the *machinery* is harder than the *problem*, the machinery is the problem.
- **You built it "for the future"** and the future is hypothetical → YAGNI.

A useful test: could you *delete* an abstraction and inline it without losing any behavior you actually ship? If yes, it's probably over-engineering. Contrast with under-engineering (a growing `switch`, copy-pasted logic, a God class) where the pain is *present*. The target is the middle: absorb the variation you can see, refuse the variation you're imagining. In interviews, explicitly narrate the trade — "I could add a plugin system, but with two formats a simple `if` is clearer; I'd extract Strategy at the third format" — because that narration *is* the senior signal.

### Q14. Design patterns vs anti-patterns vs idioms vs code smells — how do they relate?

| Concept | What it is | Example |
|---|---|---|
| **Pattern** | A named, reusable *good* solution to a recurring design problem | Strategy, Observer, Decorator |
| **Anti-pattern** | A named, recurring *bad* solution that looks reasonable | God object, golden hammer, lava flow |
| **Idiom** | A language-specific low-level convention | RAII (C++), `with` (Python), try-with-resources (Java) |
| **Code smell** | A *surface symptom* hinting at a deeper design problem | Long method, feature envy, data clumps |

They form a workflow. A **smell** is the *diagnosis prompt* — "this method is 300 lines" — that tells you something's off. It may reveal you're sitting inside an **anti-pattern** (the 300-line method belongs to a God class). The **refactoring** moves you out of the anti-pattern, often *toward* a **pattern** (extracting the varying conditional into a Strategy). **Idioms** are the local grammar you write it all in. The key relationship: smells point you at problems, anti-patterns name the bad shapes, patterns name good shapes, and refactoring is the verb that travels from one to the other.

### Q15. A teammate wants to add a plugin architecture for a feature with exactly one implementation. How do you respond?

Push back — kindly and concretely. This is textbook premature abstraction, and the right move is to make the *cost* visible.

Ask three questions: (1) **Is there a real second case, or an imagined one?** "We might add more later" is not a second case. (2) **What does the plugin system cost today?** Registration, discovery, an interface we're guessing at, config, docs, and a reader who must understand all of it to follow one code path. (3) **What does deferring cost?** Almost nothing — when the second implementation is real, extracting an interface from a working concrete class is a mechanical refactor, and now the interface fits *reality* instead of a forecast (see Q5).

Frame it as sequencing, not rejection: "Let's ship the one implementation as a plain class with a clean public method. The day a second provider is real, I'll extract the interface then — it'll take an hour and the abstraction will actually fit." That respects the teammate's instinct (extensibility matters) while applying YAGNI and "the wrong abstraction is worse than duplication." If they insist there's a *committed* second case landing next sprint, that changes the calculus — with two concrete cases in hand, the abstraction is justified.

### Q16. How do you refactor toward a pattern instead of designing to one?

"**Refactor to patterns**" (Kerievsky) inverts the usual advice: don't reach for a pattern up front, let the code's pain *reveal* which pattern it needs, then extract it. The trigger is always a concrete smell.

Worked shape — a growing conditional reveals Strategy:

```java
// Smell: a switch that grows every time a shipping method is added
BigDecimal cost(Order o) {
    switch (o.method) {
        case STANDARD: return o.weight().multiply(RATE_STD);
        case EXPRESS:  return o.weight().multiply(RATE_EXP).add(SURCHARGE);
        case FREIGHT:  return freightTable.lookup(o);   // getting ugly
    }
}
```

When the third case lands and the method sprawls, *that* is the signal to extract:

```java
interface ShippingCalculator { BigDecimal cost(Order o); }
class Standard implements ShippingCalculator { /* ... */ }
class Express  implements ShippingCalculator { /* ... */ }
class Freight  implements ShippingCalculator { /* ... */ }
// Context looks the strategy up by method; adding a fourth = one new class, no switch edit (OCP).
```

The discipline: keep changes **small and safe**, backed by tests, one move at a time (extract method → extract class → introduce the interface). You arrive at Strategy not because you planned it on day one but because the code asked for it — and now the pattern fits the real axis of variation instead of a guessed one.

## Code Smells & Refactoring

### Summary

**What this topic covers**

The practical craft of improving a design without changing its behavior. This topic has two halves. The first is the **code smell catalog** — Kent Beck and Martin Fowler's named surface symptoms (long method, large class, feature envy, primitive obsession, data clumps, shotgun surgery, divergent change, message chains, inappropriate intimacy) that tell you *where* a design hurts even before you know *why*. The second is the **refactoring toolkit** — the disciplined, behavior-preserving moves (extract method, extract class, replace conditional with polymorphism, introduce parameter object, replace temp with query) that treat those symptoms — and the safety net (tests, small steps, "Tidy First") that lets you apply them without fear. The 16 questions here cover the catalog, the moves, a full replace-conditional-with-polymorphism worked example, and how to refactor legacy code safely. Refactoring is the verb of OOD: patterns and clean models are *destinations*, refactoring is how you get there from wherever you actually are.

**Mental model**

Refactoring is **changing the structure of code without changing its observable behavior** — same inputs, same outputs, better shape. The two words that make it safe are *behavior-preserving*: if a change alters what the program does, it's not a refactor, it's a feature or a bug. Think of smells as a **doctor's symptoms**: a long method is a fever, not the disease — it *points* at a problem (this method does too many things, or names a missing abstraction) that a specific refactoring cures. Crucially, a smell is a *hint, not a law*: sometimes the 40-line method really is clearest as one piece. The engine underneath is **small, safe, reversible steps** (Beck's "Tidy First"): make one tiny structural change, run the tests, commit, repeat. This is what lets you improve a scary codebase — you never take a leap you can't undo, and the tests catch you the instant behavior drifts. Separate the two hats: *either* you're refactoring (structure, tests stay green) *or* you're adding behavior (new tests) — never both in the same step.

**Key terms**

- **Refactoring** — a behavior-preserving change to internal structure that improves readability, design, or changeability.
- **Code smell** — a surface symptom (not a bug) suggesting a deeper design problem; a prompt to investigate.
- **Long method** — a method doing too much; the most common smell, cured by extract method.
- **Large class / God class** — a class with too many responsibilities and fields; cured by extract class.
- **Feature envy** — a method more interested in another class's data than its own; move it to where the data lives.
- **Primitive obsession** — using raw primitives (`String`, `int`) for concepts that deserve a type (`Money`, `PhoneNumber`).
- **Data clump** — the same group of fields/params travelling together everywhere; wants to become an object.
- **Shotgun surgery** — one conceptual change forces edits across many classes (poor cohesion of a concern).
- **Divergent change** — one class changes for many unrelated reasons (violates Single Responsibility).
- **Message chain** — `a.getB().getC().getD()`; couples the caller to a deep structure (violates Law of Demeter).
- **Inappropriate intimacy** — two classes reach into each other's internals; too much coupling.
- **Tidy First** — Beck's practice of making small, separate, low-risk structural tidyings before (or apart from) behavior changes.

**Why interviewers ask this**

Most engineering is editing existing code, not writing greenfield — so the ability to *look at a mess and name what's wrong* is a core senior skill. Interviewers show you a bad method and watch: does the candidate immediately start rewriting (risky, junior), or do they name the smells, propose *incremental* moves, and mention tests? The vocabulary itself is a signal — saying "this is feature envy, I'd move the method to `Account`" is far stronger than "this looks messy." Replace-conditional-with-polymorphism is a favorite because it ties smells (a type-switch), a refactoring move, and a pattern (Strategy/State) together, revealing whether you understand *why* the OO version is better, not just *how*. And "how would you refactor this safely?" tests whether you respect the difference between changing structure and changing behavior — the discipline that keeps refactoring from becoming rewriting.

**Common confusions**

- "Refactoring means rewriting / cleaning up." No — refactoring is *behavior-preserving*. A rewrite that changes behavior is not a refactor.
- "A code smell is a bug." No — smelly code often works perfectly; the smell is about *maintainability*, not correctness.
- "Refactor and add the feature at once." Two hats: do them in separate steps/commits so tests isolate what broke.
- "More/smaller methods are always better." Extraction has a cost too (indirection); extract to *name a concept*, not to hit a line count.
- "You need permission/a ticket to refactor." Tidy First: small tidyings are part of doing the surrounding work, not a separate project.

**What follows from this topic**

Smells are the diagnosis; refactoring is the treatment; the destinations are the **patterns** and **clean domain models** of the neighboring topics. Replace-conditional-with-polymorphism lands you in Strategy/State; extract class and "move method to the data" lead straight into **Domain Modeling & Abstraction** (Information Expert, rich vs anemic models). And the whole discipline of small safe steps is what makes escaping the **anti-patterns** of the previous topic — God object, spaghetti, lava flow — tractable rather than terrifying.

### Q1. What is a code smell, and why isn't it the same as a bug?

A **code smell** is a *surface symptom* that hints at a deeper design problem — a method that's 300 lines, a group of parameters that always travel together, a class that changes for six unrelated reasons. Kent Beck coined the term; Fowler catalogued it. The key property: a smell is about **maintainability, not correctness.** Smelly code frequently works perfectly and passes every test.

That's exactly why it's *not* a bug. A bug is wrong behavior — the program produces the wrong output. A smell is *right behavior in a shape that will make the next change expensive, risky, or error-prone*. `if (status == 7)` computes the correct result; it's just a magic number that the next reader will misunderstand.

Smells are valuable because they're *cheap to spot and name*. You don't need to fully understand a system to notice a 500-line class or a five-link message chain. The name points you at a specific investigation and often a specific refactoring: "long method" → extract method; "data clump" → introduce parameter object. Treat a smell as a doctor treats a symptom — a prompt to look closer, not an automatic diagnosis. Sometimes you look and decide the smell is fine; the skill is knowing when.

### Q2. What is the long method smell and how do you fix it?

**Long method** is the most common smell: a single method doing too many things, so you have to read all of it (and hold a lot in your head) to understand any of it. Length is a proxy — the real issue is that the method mixes multiple *levels of abstraction* and multiple *steps* that deserve names.

The primary cure is **extract method**: pull each coherent sub-step into its own well-named method, so the original reads like a summary.

```java
// Before: one method doing validation, pricing, and notification
void checkout(Order o) {
    if (o.items.isEmpty()) throw new IllegalStateException();
    BigDecimal total = BigDecimal.ZERO;
    for (Item i : o.items) total = total.add(i.price.multiply(i.qty));
    total = total.multiply(new BigDecimal("1.08"));
    // ...15 more lines of emailing the customer...
}

// After: the method now reads as its own summary
void checkout(Order o) {
    validate(o);
    BigDecimal total = withTax(subtotal(o));
    notifyCustomer(o, total);
}
```

Related moves: **replace temp with query** (turn explanatory locals into methods), **introduce parameter object** (collapse a data clump of params), and **guard clauses** (flatten nesting). The goal isn't a line count — it's that each method operates at *one* level of abstraction and its name tells you what it does without reading the body. Don't over-extract: a one-line method named exactly like its single statement adds indirection for nothing.

### Q3. What is the large class / God class smell?

**Large class** is a class trying to do too much: too many fields, too many methods, too many responsibilities. It's the class-level cousin of long method and, taken to the extreme, the God object anti-pattern. The reliable tell isn't line count — it's that you *can't describe the class's job in one sentence* without saying "and."

The diagnostic is **cohesion**: look at which methods touch which fields. If you find clusters — methods A/B/C all use fields x/y, while D/E/F use p/q and never touch x/y — those clusters are separate responsibilities hiding in one class.

The cure is **extract class**: split each cluster into its own class and have the original hold and delegate to them.

```text
Before: Customer                 After:  Customer
+ name, email                            + name, email
+ street, city, zip, country             + Address address   (extracted)
+ formatMailingLabel()                   + PhoneNumber phone  (extracted)
+ areaCode, number
+ isValidPhone()
```

Extracting `Address` and `PhoneNumber` gives you smaller, testable, reusable value objects and a `Customer` that reads clearly. Do it incrementally with tests green at each step. The forces to watch for that *drive* the split are **divergent change** (the class changes for many reasons — see Q10) and low cohesion.

### Q4. What is feature envy and how do you fix it?

**Feature envy** is a method that's more interested in another class's data than in its own — it keeps calling getters on some other object to make a decision or compute a value. The method is in the wrong home; it "envies" the features of the class whose data it keeps reaching for.

```java
// Feature envy: this method lives in Order but obsesses over Customer's fields
class Order {
    BigDecimal discount(Customer c) {
        if (c.getTier() == Tier.GOLD && c.getYearsActive() > 5
                && c.getLifetimeSpend().compareTo(THRESHOLD) > 0) {
            return new BigDecimal("0.15");
        }
        return BigDecimal.ZERO;
    }
}
```

Every input comes from `Customer`. The fix is **move method**: relocate `discount()` (or the tier logic) onto `Customer`, which owns the data it needs. Now `Customer.discountRate()` decides, `Order` just asks:

```java
class Customer {
    BigDecimal discountRate() { /* uses own fields, no getters leaking out */ }
}
// Order: order.total().multiply(BigDecimal.ONE.subtract(customer.discountRate()));
```

This is **Information Expert** (GRASP) and **Tell-Don't-Ask** in action: put behavior where the data lives, tell the object what you want rather than pulling out its guts to decide yourself. The payoff is lower coupling (fewer getters exposed) and higher cohesion. Caveat: if the method legitimately needs data from *two* classes, envy is inevitable — put it with whichever class it uses *most*.

### Q5. What is primitive obsession and why is it a problem?

**Primitive obsession** is using language primitives (`String`, `int`, `double`, arrays) to represent concepts that deserve their own type. A phone number as a `String`, money as a `double`, a temperature as an `int`, a currency-amount pair as two loose parameters.

Why it's a problem: primitives carry no rules and no meaning. A `String phone` can hold `"not a number"`; a `double money` invites floating-point rounding errors and lets you nonsensically add a price to a latitude; an `int` temperature doesn't know its units. The validation and behavior that *should* live with the concept get scattered across every call site instead.

The fix is to **introduce a value object** (Whole Value / Money pattern):

```java
final class Money {                       // immutable value object
    private final BigDecimal amount;
    private final Currency currency;
    Money add(Money other) {              // enforces same-currency rule
        require(currency.equals(other.currency));
        return new Money(amount.add(other.amount), currency);
    }
    // equals/hashCode by value; no setters
}
```

Now the *type* enforces the rules: you can't add EUR to USD, you can't construct an invalid amount, and the concept has one home for its behavior. Signs you have this smell: constants that partition a primitive (status codes), validation logic duplicated wherever a `String` is used, and data clumps (Q6) of primitives that always travel together. This connects directly to **entities vs value objects** in domain modeling.

### Q6. What are data clumps and how do you refactor them?

A **data clump** is the same little group of data items appearing together over and over — as fields on several classes, and as parameter lists on many methods. `startDate` and `endDate`; `latitude` and `longitude`; `street`, `city`, `zip`, `country`. The tell: if you *removed one* of them, the rest would make no sense — proof they're really *one concept* wearing three or four variables.

```java
// Clump: these four always travel together
void book(String street, String city, String zip, String country, LocalDate d) { }
void ship(String street, String city, String zip, String country) { }
```

The cure is **introduce parameter object** (or extract class): give the clump a home.

```java
final class Address { final String street, city, zip, country; /* value object */ }

void book(Address addr, LocalDate d) { }
void ship(Address addr) { }
```

The payoff compounds: parameter lists shrink (fewer arguments = fewer ways to pass them in the wrong order), and — this is the real win — the new class becomes a magnet for behavior that was previously homeless. Address validation, formatting a mailing label, distance calculations all now have an obvious home on `Address` instead of being smeared across callers. Data clumps are often primitive obsession (Q5) viewed from the parameter-list angle; the same value-object fix resolves both.

### Q7. What is shotgun surgery, and how does it differ from divergent change?

Both are *change-friction* smells about cohesion, and they're opposites — interviewers love the pairing.

**Shotgun surgery**: one conceptual change forces you to make *many small edits across many classes*. Add a new order status and you must touch the validator, the persistence mapper, the UI formatter, the report, and three switch statements. The concern is *scattered* — its pieces live in too many places, so one change buckshots across the codebase.

**Divergent change**: one *class* changes for *many unrelated reasons*. `OrderService` gets edited when the tax rules change, *and* when the database schema changes, *and* when the email template changes. The class has *too many* concerns crammed together — it violates Single Responsibility.

| | Shotgun surgery | Divergent change |
|---|---|---|
| Symptom | One change → many classes edited | One class → edited for many reasons |
| Root cause | A concern is *scattered* (too spread out) | A class has *too many* concerns |
| Fix | **Move method/field** to *gather* the concern into one class | **Extract class** to *split* concerns apart |

They're duals: shotgun surgery says "pull this scattered logic together," divergent change says "push these tangled concerns apart." Both aim at the same target — each class and each concern in *one* place, so a change has *one* home.

### Q8. What are message chains and the Law of Demeter?

A **message chain** is a train of calls that navigates deep into an object graph: `order.getCustomer().getAddress().getCountry().getTaxRate()`. The caller is now coupled to the *entire shape* of that graph — every intermediate class and relationship. Change how `Customer` stores its address and this distant caller breaks.

This violates the **Law of Demeter** ("don't talk to strangers"): a method should only call methods on (1) itself, (2) its parameters, (3) objects it creates, and (4) its own direct fields — *not* on objects returned by those objects. The chain reaches through three strangers to get a tax rate.

The fix is **hide delegate**: give the near object a method that hides the traversal, so callers ask *it* rather than walking the graph.

```java
// Before: caller walks the whole graph
BigDecimal rate = order.getCustomer().getAddress().getCountry().getTaxRate();

// After: Tell-Don't-Ask — order answers the question
BigDecimal rate = order.taxRate();   // internally delegates as needed
```

Now the graph's shape is encapsulated; refactors stay local. Caveat: Demeter is a *heuristic*, not dogma — fluent builders (`builder.a().b().c()`) and stream pipelines are deliberate chains and perfectly fine, because each call returns the *same* conceptual object, not a stranger's internals. The smell is specifically *navigating structure to reach data*, not *chaining operations on one thing*.

### Q9. What is inappropriate intimacy between classes?

**Inappropriate intimacy** is two classes that are too entangled with each other's internals — they reach into each other's private-ish data, depend on each other's implementation details, and can't be understood or changed independently. It often shows up as bidirectional coupling: `A` pokes at `B`'s fields *and* `B` pokes at `A`'s.

It's a coupling smell. The cost is that the two classes effectively become one tangled unit — you can't reason about `Order` without also holding `Invoice`'s internals in your head, and a change to either ripples into the other.

Fixes, depending on the shape:

- **Move method/field** so data and the behavior that uses it live together (kills the reaching-across).
- **Extract class** to pull the shared, over-connected bits into a new class both depend on cleanly.
- **Hide delegate / narrow the interface** so each side talks to the other only through a small, intentional public surface.
- If they're *genuinely* two views of one concept, sometimes the right move is to **merge** them.

The principle underneath is **encapsulation + low coupling**: classes should collaborate through narrow, intentional interfaces, not by rummaging in each other's drawers. Inappropriate intimacy is the two-class version of what feature envy (Q4) is for a single method.

### Q10. Walk through replacing a conditional with polymorphism.

This is the flagship refactoring — it turns a type-switching conditional into a set of polymorphic classes, and it's the mechanical bridge from a smell to the Strategy/State pattern.

**The smell**: a `switch`/`if-else` on a *type code* that recurs, and grows every time a new type appears.

```java
// Before: behavior selected by a type field; every new bird = edit this switch (OCP violation)
class Bird {
    BirdType type;
    double speed() {
        switch (type) {
            case EUROPEAN: return baseSpeed();
            case AFRICAN:  return baseSpeed() - loadFactor() * numberOfCoconuts;
            case NORWEGIAN_BLUE: return isNailed ? 0 : baseSpeed(voltage);
            default: throw new IllegalStateException();
        }
    }
}
```

**The moves** (small, safe, tests green throughout):

1. Create a subclass (or Strategy implementation) per case: `European`, `African`, `NorwegianBlue`.
2. **Push down** each branch's body into `speed()` on the matching subclass.
3. Make the base `speed()` abstract; delete the `switch`.
4. Route construction through a factory that maps the old type code to the right class.

```java
// After: each type owns its own behavior; adding a type adds a class, edits no switch (OCP)
abstract class Bird { abstract double speed(); }
class European extends Bird { double speed() { return baseSpeed(); } }
class African  extends Bird { double speed() { return baseSpeed() - loadFactor()*coconuts; } }
class NorwegianBlue extends Bird { double speed() { return nailed ? 0 : baseSpeed(voltage); } }
```

**Why it's better**: adding a new bird no longer means finding and editing every `switch` on `BirdType` scattered across the codebase (which was shotgun surgery waiting to happen) — you add one class, and the compiler/dispatch does the routing. That's the Open/Closed Principle made concrete. **When *not* to**: if there's exactly *one* small conditional in *one* place and no growth expected, the `switch` is clearer than an inheritance hierarchy — don't pay for polymorphism you won't use. Prefer composition (Strategy) over inheritance when the varying behavior is orthogonal to the object's identity.

### Q11. What is the "Tidy First" approach?

"**Tidy First?**" is Kent Beck's discipline for cleaning up code around a change: make small, separate, low-risk *tidyings* — and keep them apart from behavior changes. The question mark matters — you *ask* whether tidying first will make the impending change easier, and only tidy if it will.

Two ideas do the heavy lifting:

- **Small, safe steps.** A tidying is tiny and obviously behavior-preserving: add a guard clause, extract a well-named helper, rename a confusing variable, group related declarations. Each is trivially reversible and can't break anything, so you don't need ceremony or fear to do it.
- **Separate the hats.** *Either* you're tidying (structure changes, behavior identical, tests stay green) *or* you're changing behavior (new tests). Never both in one commit — that's what makes a reviewer able to trust the tidying at a glance and lets `git bisect` pin a regression to a behavior change, not a rename.

The economic framing: tidying is an *investment* you make when it pays off *soon* (it makes today's change easier), not a grand refactoring project you schedule for "later." In practice: about to add a feature to a gnarly method? Extract a couple of helpers first (separate commit), *then* add the feature. The order — tidy, commit, then change — is the whole trick.

### Q12. Why can't you safely refactor without tests?

Because the *definition* of refactoring is "change structure **without changing behavior**" — and without tests you have no way to *know* whether behavior stayed the same. Tests are the sensor that turns "I think this is equivalent" into "the suite confirms it's equivalent." Remove them and every refactor is a leap of faith that can silently introduce a bug.

The workflow that makes refactoring safe:

1. **Green tests first** — establish the behavior you must preserve.
2. **One small move** — extract a method, rename, inline a variable.
3. **Run the tests** — still green? The behavior held. Red? Undo immediately; the step was wrong.
4. **Commit, repeat.**

This is why small steps and tests are inseparable: small steps mean that when the suite goes red, the cause is *the last tiny change*, so you can revert one move rather than debug a big tangle.

The hard case is **untested legacy code** you must refactor. Michael Feathers' answer: get it under test *first* using **characterization tests** — tests that pin down what the code *currently* does (bugs included), created by feeding inputs and asserting whatever comes out. Break dependencies at "seams" (inject a collaborator, subclass to override) so the unit is testable at all. Only once you have that net do you start refactoring. Refactoring without tests isn't refactoring — it's editing and hoping.

### Q13. When should you NOT refactor?

Refactoring is a tool with a cost, not a virtue in itself. Skip or defer it when:

- **You're mid behavior-change.** Don't refactor and add a feature in the same step — separate the hats (Q11). Land the change, then tidy in its own commit.
- **The code is stable and rarely touched.** Ugly code you never open costs nothing. Refactoring it spends effort and risk for readability no one will use. Refactor the code you're *about* to change, where the payoff is immediate.
- **A rewrite is genuinely the better call.** If the design is so wrong that incremental moves can't reach the target, and the module is small/well-specified, a clean rewrite may beat a hundred refactorings — but this is rare and easy to overestimate.
- **You lack a test net and can't cheaply add one.** Refactoring blind is unsafe (Q12); if you can't get characterization tests around it, the risk may not be worth it right now.
- **Under a hard deadline where the change is throwaway.** Beck's economic view: tidy when it pays off *soon*. If this code ships once and dies, don't gold-plate it.

The senior framing is *economic*: refactoring buys future changeability. If there's no future change coming to this code, you're buying an option you'll never exercise. Refactor where change is *actually* headed.

### Q14. How do you refactor a large legacy method safely, step by step?

Assume a 400-line method, no tests, doing validation + calculation + I/O. The order of operations is what keeps you safe.

**1. Pin behavior with characterization tests.** You may not fully understand it, so *capture* what it does: feed representative inputs, assert the actual outputs (including current quirks). This is your net — its job is to scream if behavior drifts, not to judge correctness.

**2. Find seams.** To test at all you often must break a dependency — a hard-coded `new EmailSender()`, a static clock, a direct DB call. Introduce a **seam**: pass the collaborator in, or extract it behind an interface, so the test can substitute a fake.

**3. Extract in small, safe moves.** Now apply the toolkit one step at a time, tests green after *each*:

- **Guard clauses** to flatten the validation nest.
- **Extract method** for each coherent block — `validate()`, `computeTotal()`, `persist()` — naming the concept.
- **Replace temp with query** to remove tangled locals.
- **Introduce parameter object** if a data clump falls out.

**4. Extract class** once the method's helpers cluster into responsibilities (the calculation helpers want to be a `Pricing` class).

**5. Commit constantly.** Each green step is a commit, so any red is one revert away.

The meta-point: you *don't* rewrite it. You wrap it in tests, then make a sequence of individually-trivial, individually-reversible changes, and the mess dissolves without a scary big-bang. Slow is smooth, smooth is fast.

### Q15. What's the difference between refactoring and rewriting?

| | Refactoring | Rewriting |
|---|---|---|
| Behavior | **Preserved** — same inputs/outputs throughout | May change; starts from a blank slate |
| Steps | Many tiny, reversible, tests green between each | One big replacement; "big bang" cutover |
| Risk | Low and *bounded* — a red test = one revert | High — the new thing must re-earn all the old behavior, including undocumented quirks |
| Knowledge | Preserves hard-won edge-case handling embedded in the old code | Easy to *lose* years of bug fixes you didn't know were there |
| Reversibility | Any step | All-or-nothing |

**Refactoring** transforms the existing code in place through behavior-preserving moves — the program is *runnable and correct at every step*. **Rewriting** throws it out and rebuilds, so there's a long period where the new version is incomplete and the old behavior isn't fully reproduced.

The classic trap (Joel Spolsky's "things you should never do"): teams underestimate how much *undocumented knowledge* — every weird `if` that handles a real customer case — is baked into old code. A rewrite silently drops those and reintroduces bugs the old code had already fixed. Default to **refactoring**; reserve rewriting for when the design target is genuinely unreachable by incremental steps *and* the surface area is small and well-understood. When you must replace something big, prefer the **Strangler Fig** pattern — grow the new around the old and cut over piece by piece — over a big-bang rewrite.

### Q16. You're given a 200-line method with nested conditionals and duplicated logic. What smells do you name and how do you attack it?

Lead with the *diagnosis* — naming smells is the senior signal — then propose *incremental* moves, not a rewrite.

**Smells I'd name:**

- **Long method** — 200 lines, many levels of abstraction in one place.
- **Deep nesting / arrow code** — nested conditionals I'd flatten with **guard clauses**.
- **Duplicated logic** — repeated blocks that want to be one **extracted method**.
- Likely **magic numbers/strings** and **primitive obsession** in the conditionals.
- Possibly a **type-switch** begging for **replace conditional with polymorphism** (Q10), and **data clumps** in the parameter list.

**How I'd attack it (tests first, small steps):**

1. **Characterization tests** around current behavior — I won't touch a line until I have a net (Q12).
2. **Guard clauses** to flatten the nesting and make the happy path linear.
3. **Extract method** on each coherent block; give it a name that documents intent, which also *removes the duplication* (call the one extracted method from both sites).
4. **Replace magic values with named constants/enums**; introduce a **value object** or **parameter object** if primitives/clumps fall out.
5. If a type-switch drives the branching, **replace conditional with polymorphism**.
6. **Extract class** once helpers cluster into a responsibility.

Tests stay green after every step; each step is a commit. I'd explicitly *not* do a big rewrite — the risk is uncontrolled and the old code holds edge cases I don't yet understand. The order — net, flatten, extract, name, then structure — is the answer.

## Domain Modeling & Abstraction

### Summary

**What this topic covers**

How to turn a tangle of requirements into a clean object model — the design skill *upstream* of patterns and refactoring. It covers (1) **finding the objects** — noun/verb extraction from a problem statement and why that's only a starting heuristic; (2) **entities vs value objects** — the single most important distinction in domain modeling, identity vs value; (3) **assigning responsibilities** — CRC cards and GRASP's Information Expert, deciding *which* object should own *which* behavior; (4) **rich vs anemic domain models** — putting behavior with data versus the "bag of getters + service" trap; and (5) **aggregates, invariants, and a light bounded-context / DDD intro** — grouping objects into consistency boundaries and choosing the right altitude of abstraction so you neither over- nor under-model. The 16 questions here connect the mechanics of the prior topics to *judgment*: a model is good not when it's clever but when it makes the domain's rules obvious and the likely changes cheap. Domain modeling is where OOD stops being about syntax and starts being about *understanding the business*.

**Mental model**

A domain model is a **set of objects that mirror the concepts and rules of the problem**, arranged so that the software's structure matches how a domain expert talks. The core move is: *behavior goes with the data it needs* (Information Expert / Tell-Don't-Ask), and *each concept becomes an object that enforces its own rules* (invariants). The most load-bearing decision is **identity vs value**: an **entity** is defined by a continuous identity you track through changes (this specific `Customer`, this `Order` — it has an ID and a lifecycle); a **value object** is defined *entirely by its attributes* and is interchangeable and immutable (a `Money`, a `DateRange`, an `Address` — two with the same fields are the same thing). Get that split right and much of the model falls into place. The second instinct is **altitude**: model at the level the problem actually needs — introduce a concept when it has *behavior or rules*, not because it exists in the world. A perfect model of reality is the *wrong* model; the right one captures exactly the distinctions the software must act on and no more.

**Key terms**

- **Entity** — an object with a distinct identity and lifecycle, tracked through state changes (has an ID); equality is by identity.
- **Value object** — an object defined solely by its attributes; immutable and interchangeable; equality is by value (`Money`, `Address`).
- **Domain model** — the network of objects representing the problem's concepts, relationships, and rules.
- **Rich domain model** — objects that hold data *and* the behavior/rules operating on it (behavior-rich).
- **Anemic domain model** — objects that are just data (getters/setters) with all logic in separate "service" classes; a smell/anti-pattern.
- **Responsibility** — a thing an object knows or does; the unit you assign when designing (CRC).
- **CRC card** — Class–Responsibilities–Collaborators; a lightweight index-card technique for exploring who does what.
- **Information Expert** — GRASP principle: give a responsibility to the class that has the information needed to fulfill it.
- **Invariant** — a rule that must always hold for an object/aggregate to be valid (an order's total equals the sum of its lines).
- **Aggregate** — a cluster of objects treated as one consistency/transaction boundary, accessed through a single **aggregate root**.
- **Bounded context** — an explicit boundary within which a model and its terms have one consistent meaning (DDD).
- **Ubiquitous language** — shared vocabulary between developers and domain experts, reflected directly in the code.

**Why interviewers ask this**

This is the deepest OOD signal because it can't be memorized — it tests whether you can *listen to a problem and carve it at the joints*. Junior candidates jump straight to classes and getters; senior candidates ask clarifying questions, name the entities and value objects, decide where invariants live, and defend the *altitude* of their model. The entity-vs-value-object question is a favorite precisely because getting it wrong (making `Money` an entity with an ID, or `Order` a value object) reveals a shallow model. Interviewers also probe rich vs anemic: a candidate who scatters all behavior into `OrderService` and leaves `Order` a data bag is signaling procedural code in OO clothing. And "how would you model X" questions reward the discipline of *not over-modeling* — a candidate who invents fifteen classes for a problem that needs four is as concerning as one who crams everything into one God object.

**Common confusions**

- "Every noun becomes a class." Noun extraction is a *starting* heuristic; many nouns are attributes, values, or irrelevant. Prune ruthlessly.
- "Entities and value objects are interchangeable." No — identity vs value is *the* distinction, and it dictates equality, mutability, and lifecycle.
- "A rich model just means lots of methods." No — it means behavior lives *with the data it needs*; anemic means data and behavior are split apart.
- "More classes = a more thorough model." Over-modeling is a real failure; introduce a concept only when it has behavior or rules to own.
- "The model should perfectly mirror reality." The model should capture the distinctions the *software must act on*, not reality's full complexity.
- "Value objects can't have behavior." They can and should — `Money.add()`, `DateRange.overlaps()`; they just have no identity.

**What follows from this topic**

Domain modeling is the *upstream* discipline the whole primer serves. A clean model makes the **GoF patterns** land naturally (a rich `Order` is where Strategy and State attach), makes **refactoring** goal-directed (you're refactoring *toward* the right entities and value objects), and makes the **anti-patterns** avoidable (anemic models are the God-service anti-pattern's breeding ground). Value objects here are the cure for the primitive-obsession smell; Information Expert here is the answer to feature envy. If patterns are the vocabulary and refactoring is the verb, domain modeling is the *thinking* that decides what to say.

### Q1. How do you find the objects in a set of requirements?

Start with the classic **noun/verb heuristic**, then *prune hard* — the pruning is the actual skill.

1. **Extract nouns** from the requirements as *candidate* classes and attributes: in "a *customer* places an *order* containing *line items*, pays with a *credit card*, and receives a *receipt*," the nouns are customer, order, line item, credit card, receipt.
2. **Extract verbs** as candidate *responsibilities/methods*: places, contains, pays, receives.
3. **Prune the nouns.** Most aren't classes:
   - Some are **attributes** of another object (a customer's *name*, an order's *date*).
   - Some are **value objects** not entities (money, an address).
   - Some are **synonyms** for the same concept (buyer = customer).
   - Some are **outside the boundary** — irrelevant to what the software does.
4. **Assign responsibilities** to whichever object has the data (Information Expert), often using CRC cards to explore.

The critical caveat: noun extraction is a *brainstorming primer*, not an algorithm. Blindly turning every noun into a class produces an over-modeled mess (Q13). The real work is deciding which candidates earn their place — which have *behavior or rules* to own — and which collapse into attributes or values. A good model has *fewer* classes than the noun list, each pulling real weight.

### Q2. What's the difference between an entity and a value object?

This is *the* central distinction in domain modeling.

An **entity** has a **distinct identity** that persists through change. `Customer #4471` is the same customer whether her name, address, or balance changes — you track her by identity, she has a lifecycle, and equality is *by ID*. Two customers with identical attributes are still two different customers.

A **value object** is defined **entirely by its attributes**. A `Money(10, USD)` *is* ten dollars — there's no "which ten dollars"; any two `Money(10, USD)` are interchangeable. Value objects are **immutable** and equality is *by value*.

| | Entity | Value object |
|---|---|---|
| Defined by | Identity (an ID) | Its attributes |
| Equality | By identity (`==` on ID) | By value (all fields equal) |
| Mutability | Mutable, has a lifecycle | Immutable |
| Examples | `Customer`, `Order`, `Account` | `Money`, `Address`, `DateRange`, `Color` |

```java
// Entity: two customers with same name are still different — identity matters
class Customer { final CustomerId id; String name; /* equals/hashCode on id */ }

// Value object: two equal amounts are the same — value matters; immutable
final class Money { final BigDecimal amount; final Currency currency; /* equals on both fields */ }
```

The practical test: **"If two of these have all the same fields, are they the same thing?"** Yes → value object. No, they're distinct → entity. Getting this backwards (an `Order` treated as a value, or `Money` given an ID and a mutable lifecycle) is a classic model smell. Making more things value objects than you'd expect is usually the *right* instinct — they're immutable, thread-safe, and self-validating.

### Q3. Why prefer value objects, and how do they cure primitive obsession?

Value objects are the direct cure for the **primitive obsession** smell (using `String`/`double`/`int` for concepts that deserve a type). Instead of a `double` for money or a `String` for an email, you give the concept a small immutable type that *owns its rules*.

```java
final class EmailAddress {
    private final String value;
    EmailAddress(String raw) {
        if (!raw.matches(EMAIL_REGEX)) throw new IllegalArgumentException(raw);
        this.value = raw.toLowerCase();       // validated + normalized at construction
    }
    // equals/hashCode by value; no setters
}
```

The payoffs stack up:

- **Validity by construction** — once you hold an `EmailAddress`, it's valid; the check happens *once*, at the boundary, not at every use site.
- **Behavior has a home** — `Money.add()`, `DateRange.overlaps()`, `EmailAddress.domain()` live *with* the data instead of scattered across the codebase (kills feature envy and duplication).
- **Type safety** — `charge(Money)` can't be handed a latitude; `Money(EUR)+Money(USD)` throws instead of silently producing nonsense.
- **Immutable and thread-safe** — no aliasing surprises, safe to share and use as map keys.

The cost is a few small classes, which is almost always worth it. The heuristic: whenever a primitive has *rules* (a valid range, a format, units, a same-currency constraint) or always travels with a sibling (a data clump — `amount`+`currency`), that's a value object asking to exist.

### Q4. What is an anemic domain model and why is it considered an anti-pattern?

An **anemic domain model** is one where the "domain" objects are just **data holders** — fields with getters and setters and no behavior — while *all* the logic lives in separate procedural "service" or "manager" classes. `Order` is a bag of properties; `OrderService` contains every rule about orders.

```java
// Anemic: Order is a data bag...
class Order { List<Line> lines; Status status; BigDecimal total; /* getters/setters only */ }

// ...and all behavior lives elsewhere, reaching into Order's guts
class OrderService {
    void addLine(Order o, Line l) {
        o.getLines().add(l);
        o.setTotal(o.getTotal().add(l.getSubtotal()));   // service maintains Order's invariant
    }
}
```

Martin Fowler calls it an anti-pattern because it **looks** object-oriented but **is** procedural: the objects carry no rules, so nothing protects their invariants. Any code can `setTotal()` to a value that doesn't match the lines. Behavior that belongs to `Order` is smeared across services (feature envy at scale), encapsulation is gone (everything exposes getters/setters), and the class can't guarantee it's ever in a valid state.

The nuance: anemic models aren't *always* wrong. For a thin CRUD app or a pure data-transfer layer (DTOs at a boundary), objects that are just data are appropriate and honest. The anti-pattern is specifically when a domain has *real rules* and you strand them in services instead of putting them on the objects that own the data. The fix is the **rich domain model** (Q5).

### Q5. What is a rich domain model and how do you build one?

A **rich domain model** puts behavior *with* the data it operates on: the objects don't just hold state, they enforce their own rules. It's the OO answer to the anemic model (Q4), and it's just **Information Expert + Tell-Don't-Ask** applied consistently.

```java
// Rich: Order owns its invariant; no one can put it in an invalid state
class Order {
    private final List<Line> lines = new ArrayList<>();
    private Status status = DRAFT;

    void addLine(Product p, int qty) {           // behavior lives with the data
        if (status != DRAFT) throw new IllegalStateException("can't modify a placed order");
        lines.add(new Line(p, qty));
    }
    Money total() { return lines.stream().map(Line::subtotal).reduce(Money.ZERO, Money::add); }
    void place() {
        if (lines.isEmpty()) throw new IllegalStateException("empty order");
        status = PLACED;
    }
}
```

How to build one:

1. **Ask "who has the data this rule needs?"** — put the rule there (Information Expert). The total belongs on `Order` because `Order` has the lines.
2. **Compute, don't store-and-sync** derived state — `total()` is a query over lines, so it can never drift out of sync (replace temp/field with query).
3. **Guard invariants inside mutators** — `addLine`/`place` enforce the rules, so the object is *never* invalid.
4. **Hide the internals** — no `setStatus`, no exposed mutable `lines`; you *tell* the order to `place()`, you don't reach in and flip a flag.

The service layer shrinks to orchestration (load, call one method, save) instead of holding the rules. The payoff: invariants are enforced in one place, the code reads like the domain, and behavior can't be bypassed.

### Q6. How do CRC cards help assign responsibilities?

**CRC cards** (Class–Responsibilities–Collaborators) are a lightweight, low-tech design technique: one index card per candidate class, split into three regions.

```text
+-------------------------------------------+
| Class:  Order                             |
+---------------------+---------------------+
| Responsibilities    | Collaborators       |
| - hold line items   | - Line              |
| - compute total     | - Product           |
| - enforce placement | - Customer          |
+---------------------+---------------------+
```

- **Class** — the concept's name.
- **Responsibilities** — what it *knows* and *does* (short verb phrases).
- **Collaborators** — the other classes it must talk to in order to fulfill those responsibilities.

You use them by **role-playing a scenario**: walk through "customer checks out," and physically move responsibility from card to card as you narrate — "the Order computes its total… but it needs each Line's subtotal, so Line is a collaborator." Two things fall out fast: (1) a card with *too many* responsibilities is a God-class warning (split it — divergent change), and (2) a responsibility that keeps landing on the wrong card exposes a modeling mistake.

Their value is *social and cheap*: cards are small (physically forcing you to keep responsibilities focused), disposable (you rearrange without sunk cost), and great for a group at a whiteboard *before* anyone writes code. They're a thinking tool for *distributing* behavior — the exact question the Information Expert principle answers.

### Q7. What is the Information Expert principle?

**Information Expert** is a GRASP principle answering the fundamental design question: *which class should get this responsibility?* The answer: **the class that has the information needed to fulfill it.** Put behavior where the data lives.

If you need an order's total, ask "who has the data to compute it?" — the `Order` holds the lines, so `Order.total()` is the natural home. Don't build an `OrderTotalCalculator` that reaches into the order's guts (that's feature envy and drifts toward an anemic model); the order is the expert on its own lines.

```java
// Information Expert: Order has the lines, so Order computes the total
class Order {
    private final List<Line> lines;
    Money total() { return lines.stream().map(Line::subtotal).reduce(Money.ZERO, Money::add); }
}
class Line {   // Line has qty + price, so Line computes its own subtotal
    Money subtotal() { return unitPrice.times(qty); }
}
```

Notice the *chain*: `Order` delegates each line's subtotal to `Line`, because `Line` is the expert on its own quantity and price. Responsibility flows to wherever the relevant data sits, layer by layer. This single principle drives most good responsibility assignment, produces low coupling (objects use their *own* data instead of exposing it), and directly counters feature envy. Caveat: sometimes the "expert" would take on an unrelated concern (e.g., you don't put SQL persistence on `Order` just because it has the data) — Information Expert is balanced against separation of concerns and keeping the domain free of infrastructure.

### Q8. What is an aggregate and an aggregate root?

An **aggregate** is a cluster of related objects treated as a **single unit for data changes** — one consistency and transaction boundary. The **aggregate root** is the one entity that serves as the *only* entry point: outside code holds a reference to the root and *never* to the internal members directly.

The classic example is `Order` (root) with its `OrderLine` children:

```text
+---------------- Order (aggregate root) ----------------+
|  id, status                                            |
|  + addLine(product, qty)   <-- only way in             |
|  + total()                                             |
|                                                        |
|   <>-- OrderLine   OrderLine   OrderLine  (internal)   |
+--------------------------------------------------------+
   Outside code references Order, never an OrderLine directly.
```

The rules:

- **All access goes through the root.** You don't hand out `OrderLine`s to be mutated; you call `order.addLine(...)`. The root enforces the aggregate's **invariants** (Q9) — e.g., "no lines on a placed order," "total never exceeds credit limit."
- **The aggregate is one transactional/consistency boundary.** You save/load and lock the whole aggregate together; its invariants are always consistent *within* the boundary.
- **References across aggregates are by ID, not by object.** An `Order` references a `Customer` by `CustomerId`, not by holding the `Customer` object — this keeps aggregates small and independently loadable.

Aggregates (a DDD concept) answer "how big should my objects/transactions be?" Keep them *small* — a common design error is a giant aggregate that locks half the database. The root protects consistency; the boundary keeps it manageable.

### Q9. What is an invariant and how do you enforce it in a model?

An **invariant** is a rule that must *always* be true for an object (or aggregate) to be valid — a constraint that holds before and after every operation. Examples: "an order's total equals the sum of its lines," "an account balance never goes below its overdraft limit," "a date range's end is never before its start."

The whole point of a rich domain model is that **invariants are enforced by the object that owns the data**, so the object can *never* exist in an invalid state. You do this by:

1. **Validating in the constructor** — reject invalid initial state so an object is born valid.
2. **Guarding every mutator** — each method that changes state checks the invariant before/after.
3. **Hiding the internals** — no setters or exposed mutable collections that would let outside code bypass the rules.

```java
final class DateRange {                     // invariant: start <= end, enforced at birth
    final LocalDate start, end;
    DateRange(LocalDate start, LocalDate end) {
        if (end.isBefore(start)) throw new IllegalArgumentException("end before start");
        this.start = start; this.end = end;
    }
}
class Account {                             // invariant: balance >= -overdraft
    private Money balance;
    void withdraw(Money amt) {
        Money next = balance.minus(amt);
        if (next.isLessThan(overdraftLimit.negate())) throw new InsufficientFundsException();
        balance = next;                     // only reachable if the invariant holds
    }
}
```

For a multi-object rule, the **aggregate root** (Q8) is the enforcement point — it's the only door in, so it can guarantee the invariant across its members. The anti-pattern is the anemic model: with public setters, *anyone* can violate the invariant and no single place is responsible. Encapsulation exists precisely to protect invariants.

### Q10. What is a bounded context in DDD, and why does it matter?

A **bounded context** is an explicit boundary within which a domain model — and every *term* in it — has *one consistent meaning*. It's Domain-Driven Design's answer to a real problem: the same word means different things to different parts of a business, and forcing one universal model to satisfy all of them creates a bloated, contradictory mess.

The canonical example is **"Customer."** In the *Sales* context a Customer has a pipeline, leads, and a sales rep. In *Support* a Customer has tickets and a satisfaction score. In *Billing* a Customer has invoices, a payment method, and a credit limit. These are *different models* of "customer," each correct in its own context. Trying to build one `Customer` class that serves sales, support, and billing produces a God class that's wrong for everyone.

Bounded contexts say: **draw a boundary around each, let each have its own model and its own "Customer,"** and define explicit translation (an anti-corruption layer / context mapping) where they integrate. Inside a context, the team shares a **ubiquitous language** — the same words in conversation and in code.

Why it matters for OOD: it's the large-scale version of Single Responsibility and the antidote to the over-general God model. Even in a single application, recognizing that "the thing Billing calls an Order isn't the thing Shipping calls an Order" stops you from cramming every concern into one class. You don't need full DDD to use the insight — *scope your models to a context* and the classes inside them stay coherent.

### Q11. How do you choose the right level of abstraction — avoiding over- and under-modeling?

The target is a model at **exactly the altitude the problem requires** — enough distinction to capture the rules the software acts on, no more.

**Under-modeling** (too coarse): cramming distinct concepts into one type, using primitives for things with rules (primitive obsession), one God class doing everything. Symptom: the code can't express a distinction the domain clearly makes, so rules get enforced with scattered `if`s. Fix: split out the missing concept, introduce value objects.

**Over-modeling** (too fine): a class for every noun, deep hierarchies, abstractions with a single use, speculative flexibility (patternitis). Symptom: fifteen classes for a four-concept problem; the *machinery* is harder to understand than the *domain*. Fix: collapse concepts that have no distinct behavior back into attributes/values.

The governing heuristic: **introduce a concept as its own class only when it has behavior or rules to own.** A `color` that's just a hex string is an attribute; a `Color` that must validate, convert to RGB, and compute contrast earns a class. Ask of every candidate: "Does this have rules, or does it just hold a value that something else acts on?" And model the distinctions the *software must act on* — not every distinction that exists in reality. A perfect mirror of the world is over-modeling; the map is not the territory. When unsure, err *slightly* toward simpler (under-model) and let real requirements pull concepts into existence, because splitting later is easier than unwinding a wrong abstraction.

### Q12. Should the domain model reflect reality exactly?

No — and thinking it should is a common source of over-modeling. A domain model should capture the distinctions the **software must act on**, not the full richness of the real world. "The map is not the territory."

A library system *could* model the paper weight, the ISBN check-digit algorithm, the author's biography, the exact shelf's GPS coordinates. But if the software only needs to *lend* and *reserve* books and *track* who has them, then `Book`, `Copy`, `Member`, and `Loan` — with just the attributes those operations touch — is the *right* model. Adding real-world detail the software never uses is pure cost: more fields to populate, more to test, more to misunderstand.

The discipline is **purposeful abstraction**: every concept and attribute in the model should earn its place by being something an operation reads or a rule constrains. Two consequences: (1) the same real-world thing gets *different* models in different contexts (Q10) — Billing's "Book" and Cataloguing's "Book" differ because their software does different things; (2) you deliberately *omit* real complexity that's irrelevant. The best model isn't the most faithful — it's the one that makes the *required* behavior obvious and the *likely* changes cheap, while ignoring everything the software doesn't care about.

### Q13. Walk through modeling a simple domain — e.g., a library — end to end.

Requirements: members borrow books; each book can have multiple physical copies; a copy is loaned to one member at a time; loans have due dates; you can reserve a book that's fully out.

**1. Find candidate objects (nouns).** member, book, copy, loan, reservation, due date, ISBN.

**2. Prune — decide entity vs value vs attribute:**

- **Entities** (identity + lifecycle): `Member`, `Book`, `Copy`, `Loan`, `Reservation`.
- **Value objects**: `ISBN` (validated), `DateRange`/`DueDate`, maybe `Money` for fines.
- **Attribute, not a class**: a book's *title* — no behavior, just data on `Book`.
- Note `Book` vs `Copy`: "Moby Dick" is a `Book` (the title); the three physical volumes on the shelf are `Copy` entities. Conflating them is under-modeling.

**3. Assign responsibilities (Information Expert / CRC):**

```text
+------------------------------------------------------------+
| Book              Copy               Loan                  |
| - title, ISBN     - which Book       - copy, member        |
| - list copies     - available?       - dueDate, returned?  |
| - reserve()       - checkOut()       - isOverdue()         |
+------------------------------------------------------------+
```

**4. Relationships (UML):**

```text
Book  o-- Copy          (a book aggregates its copies)
Copy  <-- Loan  --> Member   (a loan associates one copy with one member)
Book  <>-- Reservation
```

**5. Invariants & the key method:**

```java
class Copy {
    private boolean onLoan;
    Loan checkOut(Member m, Clock clock) {
        if (onLoan) throw new IllegalStateException("copy already out");   // invariant
        onLoan = true;
        return new Loan(this, m, LocalDate.now(clock).plusDays(LOAN_DAYS));
    }
}
```

**6. Where patterns *might* enter (only if forced):** a fine-calculation `Strategy` if there are multiple fine schemes; `State` for a copy's lifecycle if it grows beyond a boolean; an Observer/notification when a reserved book returns. But I'd *start* without them (Q14) and add only when a real force appears. The end state: a handful of entities, a couple of value objects, invariants living on the objects that own them, and a model that reads like how a librarian talks.

### Q14. When designing a domain model, how much should you build up front vs let emerge?

Build the **skeleton** up front, let the **details emerge** — and lean toward *less* structure early, because unwinding a wrong abstraction is costlier than adding a right one later.

**Do up front:** identify the core **entities and value objects**, the key **relationships**, and the critical **invariants**. These are the load-bearing decisions — getting entity-vs-value wrong or missing an invariant is expensive to fix and shapes everything else. This is worth a whiteboard and CRC cards *before* coding.

**Let emerge:** the pattern choices (Strategy, State, etc.), extension points, and fine-grained class splits. Don't pre-install a plugin system, a factory hierarchy, or a State machine on day one — you're guessing at variation you can't yet see (premature abstraction / patternitis). Write the simplest model that enforces today's rules, and *refactor to* patterns when a real force appears (a second fine scheme, a growing status conditional).

The balance is **YAGNI applied to structure**: model the concepts and rules you *know* exist (they're in the requirements), defer the flexibility you're *imagining*. A useful sequencing: entities/values/invariants first (hard to change, so think), then behavior with Information Expert (medium), then patterns only when duplication or a growing conditional demands them (easy to extract later). The senior instinct is to keep the model *thin and correct*, and let real requirements — not speculation — pull complexity into existence.

### Q15. How does a rich domain model relate to the service/application layer?

They're different layers with a clean division of labor, and getting it right is what keeps you *out* of the anemic-model trap.

- The **domain model** (entities, value objects, aggregates) owns the **business rules and invariants** — *what* is valid, *how* a total is computed, *when* an order can be placed. Behavior lives with the data (Q5).
- The **application/service layer** owns **orchestration** — it doesn't contain business rules; it *coordinates*: load the aggregate from a repository, call one or two domain methods, save the result, manage the transaction, talk to infrastructure (email, external APIs).

```java
// Application service: thin orchestration, no business rules
class PlaceOrderService {
    void handle(OrderId id) {
        Order order = orders.findById(id);   // load aggregate
        order.place();                       // <-- the RULE lives in the domain, not here
        orders.save(order);                  // persist
        notifier.orderPlaced(order);         // side effect
    }
}
```

The tell of a *healthy* split: the service reads like a to-do list (load, call, save, notify) with no `if` about *business* conditions — those are inside `order.place()`. The tell of an *anemic* model: the service is fat with rules (`if (order.getStatus() == DRAFT && !order.getLines().isEmpty()) order.setStatus(PLACED)`) and the entity is a data bag. If you find business logic creeping into the service, that's a signal to **push it down** into the domain object that owns the data (Information Expert). Infrastructure concerns (SQL, HTTP) stay *out* of the domain — the model depends on nothing; the service wires it to the outside world (dependency inversion at the boundary).

### Q16. You're modeling a payment system. Walk through the key domain-modeling decisions.

Lead with the *distinctions* — that's where the modeling judgment shows.

**1. Entities vs value objects (the load-bearing call):**

- `Payment` and `Account` are **entities** — they have identity and a lifecycle you track (this specific payment, its status over time).
- `Money` is a **value object** — immutable, equality by value, and it *owns the same-currency invariant*. Never model money as a `double`; that's primitive obsession inviting rounding bugs and currency mixups.
- `PaymentMethod` details, `CardNumber` (validated, and you'd store only a token — no PII), and a `TransactionId` are value objects.

**2. Invariants that must never break:** an `Account` balance never violates its limit; a `Payment` can't move from `SETTLED` back to `PENDING`; `Money` arithmetic can't cross currencies. These live *on the objects* (Q9), enforced in constructors and guarded mutators.

**3. Where behavior varies → a pattern, but only for real variation:**

```java
interface PaymentStrategy { Receipt charge(Money amount); }   // card, wallet, bank transfer
```

Multiple payment providers is a *genuine* force, so **Strategy** is justified here (unlike a speculative one). A `Payment`'s lifecycle (PENDING → AUTHORIZED → SETTLED → REFUNDED) with real transition rules is a candidate for **State**.

**4. Aggregate boundary:** `Payment` is likely its own aggregate root; it references `Account` by **ID**, not by holding the object, so the two can be loaded and locked independently (Q8).

**5. Rich, not anemic:** `payment.refund()` enforces "can only refund a settled payment" *itself* — the rule doesn't live in a `PaymentService`. The service layer just orchestrates (authorize → capture → record → notify) and handles infrastructure.

**6. Concurrency & correctness:** money and idempotency matter — `Money` is immutable (safe to share), and I'd make charge operations idempotent (a `TransactionId` guards against double-charging on retry). The headline decisions: `Money` as a self-validating value object, invariants on the entities, Strategy for the *real* provider variation, ID references across aggregates, and a thin service layer over a rich model.
## Composition, Inheritance & Polymorphism in Practice

### Summary

**What this topic covers**

This is where the textbook slogan "favour composition over inheritance" gets forced to defend itself. The three OO pillars of code reuse and extension — **inheritance**, **polymorphism**, and **delegation/composition** — collide in day-to-day design, and this topic is about knowing which to reach for and, more importantly, when each one *fails*. The 16 questions here cover: when inheritance is genuinely the right tool versus when it's a trap; the **fragile base class** problem; how inheritance can silently violate the **Liskov Substitution Principle**; **delegation** and **composition** as the alternatives; **mixins/traits** for horizontal reuse; **generics/bounded types** as a third form of polymorphism; **duck typing**; **interface default methods** and the **diamond problem**; the case for programming to interfaces plus composition; and the runtime cost of **dynamic vs static dispatch**. This is the practical, opinionated half of OO — the part interviewers use to separate people who've *maintained* a deep inheritance hierarchy from people who've only read about one.

**Mental model**

Think of reuse as answering two orthogonal questions: *"is this an X?"* (substitutability) and *"does this use an X?"* (collaboration). Inheritance answers the first and *forces* the second; composition answers only the second and leaves you free. Inheritance is a compile-time, permanent, whitebox coupling — the subclass sees protected internals and is welded to the superclass's implementation. Composition is a runtime, swappable, blackbox coupling — the outer object holds a reference and talks through an interface. The senior instinct: reach for inheritance **only** when there's a true *is-a* relationship *and* you want subtype polymorphism *and* the base is stable and designed for extension. Everywhere else, hold an object and delegate. Polymorphism itself has three flavours — **subtype** (override + dynamic dispatch), **parametric** (generics), and **ad-hoc** (overloading) — and "program to an interface" is really "depend on the subtype-polymorphism boundary, not the concrete class behind it." Get comfortable saying "I'd model that with a strategy field, not a subclass."

**Key terms**

- **Inheritance (is-a)** — a subclass extends a superclass, inheriting state + behaviour and gaining substitutability. Whitebox, compile-time, single (in most languages).
- **Composition (has-a, owns)** — an object holds another and forwards calls; exclusive lifetime. Blackbox, runtime-swappable.
- **Delegation** — forwarding a method call to a held collaborator so *it* does the work; the mechanism behind composition-based reuse.
- **Fragile base class** — changes to a superclass silently break subclasses that depended on its internal call structure.
- **Liskov Substitution Principle (LSP)** — a subtype must be usable anywhere its supertype is expected without surprising callers.
- **Mixin / trait** — a reusable bundle of behaviour mixed into unrelated classes for horizontal reuse without a shared base.
- **Parametric polymorphism** — generics/templates; one implementation parameterised over types (`List<T>`).
- **Bounded type** — a generic constrained to a supertype (`<T extends Comparable<T>>`) so the code can call known methods.
- **Duck typing** — "if it walks like a duck," structural typing at runtime (Python/JS) rather than a declared interface.
- **Default method** — an interface method with a body; enables interface evolution but reintroduces a diamond problem.
- **Static vs dynamic dispatch** — resolving a call at compile time (overload/`final`/non-virtual) vs runtime (virtual/override via a vtable).

**Why interviewers ask this**

"Composition over inheritance" is the single most-parroted OO slogan, so interviewers probe it to find out whether you *understand* it or just *recite* it. A junior says "composition is more flexible" and stops. A senior can produce a concrete LSP violation (Rectangle/Square, or a `Stack extends ArrayList`), explain *why* the fragile base class problem makes deep hierarchies expensive to change, and then show the composition refactor with code. They ask because inheritance misuse is one of the most common sources of legacy pain: a five-level hierarchy where nobody dares touch the base class. Signal comes from nuance — knowing that inheritance is still correct sometimes (Template Method, sealed hierarchies, framework extension points), that generics are polymorphism too, and that "favour composition" is a *default*, not a religion. The candidate who can argue *both* sides and pick based on stability and substitutability is the one who's shipped and maintained real hierarchies.

**Common confusions**

- "Composition over inheritance means never inherit" — no; it means *default* to composition. Template Method, sealed ADTs, and framework hooks are legitimate inheritance.
- "Inheritance is for code reuse" — it's for *subtyping*. If all you want is reuse without substitutability, that's what composition/delegation is for.
- "If it compiles, LSP holds" — LSP is behavioural, not syntactic. `Square extends Rectangle` compiles and still violates it.
- "Interfaces can't have implementation" — default methods (Java 8+, and traits/mixins elsewhere) carry behaviour.
- "Overloading is polymorphism at runtime" — overloading is *static* (ad-hoc) dispatch, resolved by the compiler on declared types.
- "Duck typing is the same as an interface" — duck typing is structural and runtime; an interface is nominal and checked. Both give polymorphism, differently.

**What follows from this topic**

Everything here feeds the pattern catalogue: Strategy, Decorator, Bridge, State and Adapter are all "composition + delegation instead of inheritance" made concrete, and the Template Method pattern is the one place inheritance earns its keep. LSP connects directly to the SOLID topic and to designing stable interfaces in **Designing for Change & Extensibility**. The dispatch-cost discussion links to performance-aware OO. And the immutability-and-value-object thread reappears in **Concurrency & Thread-Safety in OOD**, where "compose small immutable pieces" becomes the safest design default of all.

### Q1. What is polymorphism, and what are its different forms?

Polymorphism means "one interface, many implementations" — the same call site behaves differently depending on the underlying type. There are three forms worth naming in an interview:

**Subtype (inclusion) polymorphism** — the classic one. A variable of a supertype refers to a subtype instance, and virtual method calls dispatch to the subtype's override at runtime.

```java
Shape s = new Circle(5);
s.area(); // dispatches to Circle.area() via dynamic dispatch
```

**Parametric polymorphism** — generics/templates. One body parameterised over a type, checked at compile time: `List<T>`, `Comparator<T>`. No dynamic dispatch needed.

**Ad-hoc polymorphism** — overloading (and operator overloading in C++). Same name, different signatures, resolved *statically* by the compiler on the declared argument types.

The interview trap: candidates say "polymorphism" and mean only the first. Naming all three — and knowing subtype is dynamic while overloading is static — is the senior tell.

### Q2. When is inheritance the right tool, and when is it the wrong one?

Inheritance is right when **all** of these hold: there's a genuine *is-a* relationship, you want subtype polymorphism (callers treat subclasses through the base type), the base class is stable, and it was *designed* for extension (documented protected hooks, or `final` where override is unsafe). Classic legitimate uses: Template Method, sealed algebraic hierarchies (`sealed interface Shape permits Circle, Square`), and extending a framework base class at a documented extension point.

Inheritance is wrong when you're reaching for it purely to **reuse code** ("I need those methods, so I'll extend the class"). That welds you to the parent's implementation and invites the fragile base class problem. It's also wrong when the relationship is really *has-a* or *can-do* rather than *is-a*.

| Signal | Prefer inheritance | Prefer composition |
|---|---|---|
| Relationship | true is-a + substitutable | has-a / uses-a / can-do |
| Reason | subtype polymorphism | reuse without subtyping |
| Base stability | stable, designed for extension | volatile or third-party |
| Variation at runtime | fixed at compile time | needs to swap behaviour |
| Number of varying axes | one | two or more (avoid class explosion) |

Litmus test: if you'd be tempted to override a method to *return nothing* or *throw*, the is-a is a lie — use composition.

### Q3. What is the fragile base class problem?

The fragile base class problem is when a seemingly safe change to a superclass breaks subclasses, because subclasses depended on the *internal* behaviour or self-call structure of the base — details the base author never promised to keep stable.

Classic example: a collection whose `addAll` internally calls `add` in a loop.

```java
class CountingList<E> extends ArrayList<E> {
    int added = 0;
    @Override public boolean add(E e) { added++; return super.add(e); }
    @Override public boolean addAll(Collection<? extends E> c) {
        added += c.size();            // count them here...
        return super.addAll(c);        // ...but super.addAll ALSO calls add()!
    }
}
```

If `ArrayList.addAll` is implemented by calling `add` in a loop, every element is counted **twice**. The subclass is correct against one implementation of the base and wrong against another — and the base is free to change that internal detail in any release. This is exactly why *Effective Java* Item 18 says "favour composition over inheritance": wrap the list and delegate, and you depend only on the public contract, not the self-call structure.

### Q4. Give a concrete example of inheritance violating the Liskov Substitution Principle.

The canonical one is **Square extends Rectangle**. A rectangle lets you set width and height independently; a square can't. So the subclass has to break the contract.

```java
class Rectangle {
    protected int w, h;
    void setWidth(int w)  { this.w = w; }
    void setHeight(int h) { this.h = h; }
    int area() { return w * h; }
}
class Square extends Rectangle {
    @Override void setWidth(int w)  { this.w = w; this.h = w; } // keep it square
    @Override void setHeight(int h) { this.w = h; this.h = h; }
}
```

Now any code written against `Rectangle` breaks:

```java
void resizeAndCheck(Rectangle r) {
    r.setWidth(5);
    r.setHeight(4);
    assert r.area() == 20; // holds for Rectangle, FAILS for Square (area == 16)
}
```

`Square` is substitutable syntactically but violates a **behavioural** invariant callers relied on. LSP is about behaviour, not compilation. The fix: don't make `Square` a subtype of `Rectangle`. Model both as immutable `Shape` value objects with an `area()` method and no mutating setters, or use composition. The deeper lesson: *is-a in geometry is not is-a in code* — substitutability is a property of the mutable contract, not the noun.

### Q5. What is delegation, and how does it differ from inheritance?

Delegation is when an object handles a request by forwarding it to a held collaborator, which does the real work. It's the *mechanism* that makes composition a reuse strategy.

```java
// Inheritance: Stack IS-A list — exposes everything, incl. add(i, e), get(i)... leaky!
class Stack<E> extends ArrayList<E> { /* ... */ }

// Delegation: Stack HAS-A list — exposes only the stack contract
class Stack<E> {
    private final List<E> items = new ArrayList<>();   // delegate
    public void push(E e) { items.add(e); }
    public E pop()        { return items.remove(items.size() - 1); }
    public boolean isEmpty() { return items.isEmpty(); }
}
```

The differences: with inheritance the relationship is fixed at compile time, whitebox (subclass sees protected internals), and the subclass inherits the *entire* public surface (a `Stack extends ArrayList` leaks `get(i)`, `add(i,e)` — breaking the stack abstraction). With delegation the relationship is runtime-swappable, blackbox (you only touch the public API), and you expose exactly the surface you choose. The cost is boilerplate forwarding methods — which is why some languages add first-class delegation (Kotlin's `by`, C#'s explicit interface forwarding).

### Q6. What are mixins and traits, and what problem do they solve?

Mixins/traits give **horizontal** reuse: a bundle of behaviour you can mix into otherwise-unrelated classes without forcing them into a shared base class or a single-inheritance chain. They solve the "I want these three methods in five unrelated classes" problem that single inheritance can't.

- **Ruby/Python mixins** — a module/class of methods mixed in (`include Comparable`, or multiple inheritance in Python).
- **Scala/Rust/PHP traits** — named, composable behaviour units; Scala's `trait` can carry state and be stacked.
- **Java** — approximated with **interface default methods**: an interface ships behaviour, and a class picks up several.

```java
interface Timestamped {           // a "trait" via default methods
    Instant createdAt();
    default boolean isStale(Duration d) {
        return createdAt().plus(d).isBefore(Instant.now());
    }
}
```

The tradeoff: mixins reintroduce multiple-inheritance headaches — name collisions, ordering (Python's MRO, Scala's linearization), and the diamond problem. Use them for cross-cutting, stateless capability (`Comparable`, `Serializable`, `Printable`), not for core domain modelling.

### Q7. How do generics/bounded types provide reuse without inheritance?

Generics give **parametric polymorphism**: one implementation that works for many types, checked at compile time, with no base class and no runtime dispatch. Instead of an `Object`-typed container (unsafe casts) or an inheritance hierarchy of typed containers (duplication), you parameterise.

**Bounded types** add constraints so the generic code can actually call methods on `T`:

```java
// Upper bound: T must be Comparable, so we can call compareTo
static <T extends Comparable<T>> T max(List<T> xs) {
    T best = xs.get(0);
    for (T x : xs) if (x.compareTo(best) > 0) best = x;
    return best;
}
```

This is reuse *without* a shared supertype at the object level — `Integer` and `LocalDate` never share a domain base, yet `max` works for both because both are `Comparable`. Compared with inheritance: generics vary the *type*, inheritance varies the *behaviour*. Compared with `Object` + casts: generics move the safety to compile time. The senior framing: prefer generics for containers and algorithms (structure that's type-agnostic), and reserve subtype polymorphism for genuinely varying *behaviour*.

### Q8. What is duck typing, and how does it relate to interfaces?

Duck typing is structural, runtime polymorphism: "if it responds to the methods I call, I'll treat it as the right type" — no declared interface, no `implements`. Named for "if it walks like a duck and quacks like a duck, it's a duck."

```python
def render(shape):
    return shape.area()   # works for ANYTHING with an .area() method

render(Circle(5))         # fine
render(Square(4))         # fine — no common base class required
```

Contrast with a nominal interface (Java/C#): there the compiler checks a *declared* contract; duck typing checks nothing until the call happens (or via structural typing in TypeScript / Go's implicit interfaces / Python `Protocol`, which move the check earlier). Both achieve subtype-style polymorphism. Duck typing buys flexibility and less ceremony at the cost of compile-time safety and discoverability — a typo or missing method surfaces at runtime. The modern middle ground is **structural typing with static checking**: Go interfaces (implemented implicitly), TypeScript's shape-based types, and Python's `typing.Protocol` give you duck-typing ergonomics with compile-time verification.

### Q9. What are interface default methods, and what diamond problem do they create?

A **default method** is an interface method with a body (Java 8+). It exists so a library can add a method to a published interface *without breaking* every existing implementer — the interface can evolve.

```java
interface Logger {
    void log(String msg);
    default void warn(String msg) { log("WARN: " + msg); } // added later, no breakage
}
```

The cost is a **diamond problem**: if a class implements two interfaces that both provide a default method with the same signature, which one wins?

```java
interface A { default String hi() { return "A"; } }
interface B { default String hi() { return "B"; } }
class C implements A, B {
    // COMPILE ERROR unless C resolves it explicitly:
    @Override public String hi() { return A.super.hi(); }  // pick one
}
```

Java forces you to override and disambiguate with `A.super.hi()` — it refuses to guess. This is why Java allows multiple inheritance of *behaviour* (default methods) but still forbids multiple inheritance of *state* (no fields in interfaces): state is where the original C++ diamond gets genuinely ambiguous (which copy of the field?). C++ solves its version with virtual inheritance; Java sidesteps it by keeping interfaces stateless.

### Q10. Why favour "program to an interface, not an implementation"?

Because it decouples callers from concrete classes, so you can swap, mock, or extend implementations without touching the caller. Depend on the *capability*, not the *class that happens to provide it*.

```java
// Coupled: caller welded to ArrayList and its constructor
ArrayList<Order> orders = new ArrayList<>();

// Decoupled: caller depends only on the List contract
List<Order> orders = new ArrayList<>();   // swap to LinkedList / immutable list freely

void process(List<Order> orders) { ... }  // accepts ANY List — testable with a stub
```

Combined with composition, this is the backbone of the flexible patterns: Strategy holds a `SortStrategy` interface, not a `QuickSort` class; a service depends on a `PaymentGateway` interface, injected, so tests pass a fake. The rule sharpens dependency direction: high-level policy depends on an abstraction, and the concrete implementation depends on that same abstraction (this is Dependency Inversion). Caveat — don't over-abstract: an interface with exactly one implementation that will never have another is speculative generality (YAGNI). Introduce the interface when a second implementation, a test seam, or a stability boundary actually justifies it.

### Q11. Show a refactor from an inheritance hierarchy to composition (Strategy).

Suppose ducks vary by *how they fly* and *how they quack*. Inheritance forces those axes into the class tree and explodes:

```java
// BEFORE: behaviour baked into subclasses → class explosion, no runtime change
abstract class Duck { abstract void fly(); abstract void quack(); }
class MallardDuck extends Duck { void fly(){...} void quack(){...} }
class RubberDuck  extends Duck { void fly(){/*can't!*/} void quack(){/*squeak*/} }
// A flying rubber duck? A new subclass for every combination.
```

Extract the varying behaviour behind interfaces and hold them as fields — the Strategy pattern:

```java
interface FlyBehavior  { void fly(); }
interface QuackBehavior { void quack(); }

class Duck {
    private FlyBehavior   fly;     // composed strategies
    private QuackBehavior quack;
    Duck(FlyBehavior f, QuackBehavior q) { this.fly = f; this.quack = q; }
    void performFly()   { fly.fly(); }
    void performQuack() { quack.quack(); }
    void setFly(FlyBehavior f) { this.fly = f; }   // change behaviour at RUNTIME
}
```

Now a rubber duck is `new Duck(new NoFly(), new Squeak())`, any combination is free, and a duck can gain flight at runtime via `setFly`. This is "encapsulate what varies" plus "composition over inheritance" made concrete — the class diagram flattens and the combinatorial explosion disappears.

### Q12. Static dispatch vs dynamic dispatch — what's the difference and the cost?

**Static dispatch** — the compiler picks the target method at compile time from the *declared* type. Overloading, `static`/`private`/`final` methods, and non-virtual calls (C++ default). Zero runtime lookup; inlinable.

**Dynamic dispatch** — the runtime picks the target from the *actual* object's class. Virtual/overridden methods (Java methods are virtual by default; C++ needs `virtual`). Implemented via a **vtable**: each object points to its class's table of method pointers, and a call is an indirect jump.

```text
obj ---> [ vptr ] ---> Class vtable
                        +------------------+
                        | area()  -> 0x...  |
                        | draw()  -> 0x...  |
                        +------------------+
```

Cost: dynamic dispatch adds a pointer indirection and, more importantly, can *block inlining* and hurt branch prediction on hot paths. In practice the JIT often devirtualizes monomorphic call sites (only one type ever seen), so the cost approaches zero — until the site becomes megamorphic (many types), when it degrades. Design takeaway: don't fear virtual calls in normal code; do be aware on tight inner loops. Use `final` (Java) / non-virtual (C++) to signal "not overridden" — it documents intent *and* helps the optimizer.

### Q13. When would you deliberately choose inheritance over composition?

A few cases where inheritance is genuinely the better tool:

- **Template Method** — the base fixes an algorithm skeleton and defers steps to subclasses via protected abstract hooks. The base *owns* the flow; subclasses fill blanks. Composition can't express "call these steps in this fixed order" as cleanly.
- **Sealed / algebraic hierarchies** — `sealed interface Expr permits Add, Mul, Lit`. A closed set of subtypes you pattern-match over; the compiler checks exhaustiveness. This is data modelling, not code reuse.
- **Framework extension points** — extending `AbstractList`, `HttpServlet`, a React `Component`: the framework designed the base for subclassing and documents the hooks.
- **True substitutable is-a with polymorphism** — `Circle`/`Square` implementing an abstract `Shape.area()`, where callers legitimately treat all shapes uniformly and no LSP violation exists.

The common thread: inheritance wins when you want the *type* relationship and substitutability, the base is stable and extension-designed, and there's a single axis of variation. The moment you have two varying axes, volatile bases, or you're inheriting only to grab methods, switch to composition.

### Q14. How do you decide between an abstract class and an interface when designing for reuse?

Default to an **interface** — it keeps types decoupled, allows multiple inheritance of contract, and (with default methods) can still ship some behaviour. Reach for an **abstract class** when you need shared *mutable state*, a constructor to enforce an invariant, or a Template Method skeleton with protected hooks.

| | Abstract class | Interface |
|---|---|---|
| State/fields | Yes (incl. mutable) | Constants only |
| Constructor | Yes | No |
| Multiple inheritance | No (single) | Yes |
| Default behaviour | Concrete methods | Default methods |
| Best for | shared state + template method | capability contract, mix-in |

A frequently-effective combination: publish an **interface** as the type callers depend on, and provide an optional **abstract skeletal implementation** (`AbstractList`, `AbstractSet`) that new implementers *may* extend to avoid boilerplate. Callers program to the interface; implementers get reuse from the skeleton — without the interface itself imposing an inheritance constraint. This is exactly how the Java Collections framework is designed, and it's the pattern to cite in an interview.

### Q15. What is the "class explosion" problem and how does composition fix it?

Class explosion is when independent axes of variation are modelled through inheritance, so you need a subclass for every *combination*. With coffee variants: `Coffee`, `CoffeeWithMilk`, `CoffeeWithMilkAndSugar`, `CoffeeWithSoyMilk`, `CoffeeWithSoyMilkAndSugarAndCaramel`... the tree grows multiplicatively with each new option.

Composition collapses it. The **Decorator** pattern wraps a base object in stackable behaviour layers:

```java
interface Beverage { double cost(); }
class Espresso implements Beverage { public double cost() { return 2.0; } }

abstract class AddOn implements Beverage {          // wraps a Beverage
    protected final Beverage inner;
    AddOn(Beverage b) { this.inner = b; }
}
class Milk  extends AddOn { Milk(Beverage b){super(b);}  public double cost(){ return inner.cost()+0.5; } }
class Sugar extends AddOn { Sugar(Beverage b){super(b);} public double cost(){ return inner.cost()+0.2; } }

Beverage order = new Sugar(new Milk(new Espresso())); // compose any combination
```

`n` options give `2^n` combinations from just `n` decorator classes instead of `2^n` subclasses. Same principle behind Strategy (swap one axis) and Bridge (separate two hierarchies so they vary independently). The root fix is always: pull each varying axis out into its own composed object.

### Q16. Someone says "inheritance is just for code reuse." Push back.

That framing is the root cause of most inheritance misuse. Inheritance's *primary* purpose is **subtyping** — establishing an is-a relationship so subclasses are substitutable for the base (LSP). Code reuse is a *side effect*, and treating it as the goal leads to extending classes purely to grab their methods, which welds you to their implementation and invites the fragile base class problem.

If all you want is reuse without substitutability, **delegation/composition** does it better: you get the methods without the coupling, without inheriting the entire public surface, and with the freedom to swap the collaborator at runtime. The test: ask "do callers need to treat instances of my class *as* the base type, polymorphically?" If yes, inheritance may be right. If you just want the base's behaviour available internally, hold an instance and forward.

So the correction is: **inherit for is-a and polymorphism; compose for reuse.** *Effective Java* Item 18 ("favour composition over inheritance") exists precisely because the "inheritance = reuse" mental model produces brittle hierarchies that are painful to change.

## Designing for Change & Extensibility

### Summary

**What this topic covers**

Software's one certainty is that requirements change, and good OO design is largely the art of *localising* the impact of change. This topic is about designing systems that grow by **adding** code rather than **editing** existing code. The 16 questions cover: the **Open/Closed Principle** in practice — real extension points, hooks, and plugins; using **Strategy** and **Factory** for pluggability; an intro to **hexagonal architecture / ports & adapters**; **dependency inversion at boundaries**; how to design **stable interfaces** that won't churn; **feature flags and configuration** as change mechanisms; the **anti-corruption layer** for integrating with foreign models; the tension between avoiding **speculative generality (YAGNI)** and leaving room to grow; and the concrete skill of designing an **API or library that others extend**. This is the architecture-adjacent end of low-level design: still classes and interfaces, but viewed through the lens of "where will the next change land, and does my design absorb it gracefully?"

**Mental model**

Design for change by identifying the **axis of variation** — the thing most likely to differ or grow — and putting a **stable abstraction** across it, so new variants plug in behind the interface without the core noticing. The mental picture is a stable core surrounded by a ring of pluggable adapters: the core depends *inward* on abstractions it owns; volatile details (databases, APIs, UI, third-party SDKs) live at the edge and depend inward toward the core. This is the Dependency Inversion Principle scaled up to architecture, and it's exactly what hexagonal architecture draws. The discipline is knowing *which* changes to design for — you can't anticipate everything, and trying to (speculative generality) is as costly as anticipating nothing. The heuristic: don't build the abstraction on the first case, build it on the *second* (the "rule of three"), when the axis of variation is proven rather than guessed. Stable interfaces are a promise; treat every published interface as a contract you'll have to honour or version.

**Key terms**

- **Open/Closed Principle (OCP)** — open for extension, closed for modification: add behaviour via new code, not by editing tested code.
- **Extension point / hook** — a designated place (an interface, an abstract method, an event) where new behaviour plugs in.
- **Plugin architecture** — the core discovers and loads implementations of a known interface at runtime (SPI, DI registration).
- **Dependency Inversion (DIP)** — high-level modules and low-level modules both depend on an abstraction owned by the high-level side.
- **Ports & adapters (hexagonal)** — the application core defines *ports* (interfaces); *adapters* connect them to the outside world.
- **Anti-corruption layer (ACL)** — a translation boundary that keeps a foreign/legacy model from leaking into your domain.
- **Feature flag** — runtime configuration that toggles behaviour without redeploying, decoupling deploy from release.
- **Stable interface** — an abstraction designed to not change: small, intention-revealing, free of implementation leakage.
- **YAGNI** — "You Aren't Gonna Need It": don't build for imagined future requirements.
- **Speculative generality** — a smell: abstraction, hooks, or parameters added for use cases that never arrive.
- **Seam** — a place where you can alter behaviour without editing in that place (Michael Feathers); the unit of testability and extension.

**Why interviewers ask this**

Because designing for change is the difference between a codebase that ages well and one that calcifies. Juniors optimise for "make it work now"; seniors also ask "what happens when payment provider #2 arrives, or when we need to swap Postgres for DynamoDB?" Interviewers use OCP questions to see whether you can spot the variation axis and design a plug-point *before* the switch statement grows to twenty cases. They probe hexagonal architecture and dependency inversion to check you understand *dependency direction* — that the domain shouldn't import the database driver. And they push on YAGNI to make sure you're not the opposite failure mode: the architect who builds a plugin framework for a feature with one implementation. The strongest signal is judgement — knowing *when* to add the abstraction (proven second case, real stability boundary, test seam) and when to leave a simple `if`. That balance is hard-won and very visible in an interview.

**Common confusions**

- "OCP means never edit code" — it means design so the *common* change is additive; you still edit for bug fixes and genuine contract changes.
- "More abstraction = more flexible" — past a point it's speculative generality that *adds* coupling and cognitive load.
- "Hexagonal is a distributed-systems thing" — it's a class-level dependency-direction discipline; it applies to a single service or module.
- "Dependency injection is dependency inversion" — DI is the *mechanism* (pass collaborators in); DIP is the *principle* (depend on abstractions, owned by the high-level side).
- "Feature flags are just config" — they're a change/release strategy that also incurs debt (combinatorial states, dead flags) if not retired.
- "Design the interface for every future need" — the opposite; small stable interfaces age better than big speculative ones.

**What follows from this topic**

The mechanisms here are the creational and behavioural patterns wearing an architectural hat: Strategy and Factory are the workhorses of pluggability, Abstract Factory and Builder configure families of extensions, and Adapter is literally the "A" in ports-and-adapters. The dependency-direction discipline is the SOLID topic's DIP taken to boundaries, and stable-interface design connects back to **Composition, Inheritance & Polymorphism** (program to an interface). When change involves shared mutable state across threads, the safest extension default — immutable, composed value objects — carries straight into **Concurrency & Thread-Safety in OOD**.

### Q1. What does the Open/Closed Principle look like in practice?

OCP: software entities should be **open for extension but closed for modification** — you add new behaviour by writing new code, not by editing existing, tested code. The practical smell it targets is the ever-growing `switch`:

```java
// CLOSED to extension the wrong way — every new type edits this method
double area(Shape s) {
    switch (s.type) {
        case CIRCLE: return Math.PI * s.r * s.r;
        case SQUARE: return s.side * s.side;
        // add TRIANGLE → edit here, re-test everything, risk regressions
    }
}
```

The OCP-compliant version pushes the variation behind an abstraction, so a new shape is a new class:

```java
interface Shape { double area(); }
class Circle implements Shape { public double area(){ return Math.PI*r*r; } }
class Square implements Shape { public double area(){ return side*side; } }
// New shape? Add a class. area() dispatches polymorphically. No existing code edited.
```

In practice OCP is achieved through polymorphism, Strategy, Template Method, and plugin interfaces. The honest caveat interviewers want to hear: OCP is a *goal*, not an absolute — you don't pre-abstract every axis (that's speculative generality). You apply it to the axis that's *proven* to vary. "Replace conditional with polymorphism" is the refactoring move that gets you there when the switch has earned it.

### Q2. How do Strategy and Factory enable pluggability?

They're the two halves of a plug-point: **Strategy** defines the swappable behaviour behind an interface; **Factory** decides which one to instantiate, so the caller stays ignorant of concrete types.

```java
interface ShippingStrategy { Money cost(Order o); }
class StandardShipping implements ShippingStrategy { ... }
class ExpressShipping  implements ShippingStrategy { ... }

class ShippingFactory {                            // isolates the "which" decision
    ShippingStrategy forMethod(String method) {
        return switch (method) {
            case "express" -> new ExpressShipping();
            default        -> new StandardShipping();
        };
    }
}
```

Strategy gives you the *extension point* (add a new `ShippingStrategy` class); Factory *centralises the selection* so there's exactly one place that knows the mapping, rather than `new ExpressShipping()` scattered through the code. Adding overnight shipping becomes: write the class, register it in the factory — no caller changes. Push it further and the factory reads a registry populated at startup (a mini plugin system), so even the factory doesn't need editing. The pairing is the everyday realisation of OCP: Strategy opens the behaviour for extension, Factory keeps construction closed to modification.

### Q3. What is hexagonal architecture (ports and adapters)?

Hexagonal architecture puts your **application core** (domain + use cases) in the middle, with the outside world reaching it only through **ports** (interfaces the core defines) implemented by **adapters** (the concrete tech).

```text
        +-------------------+  driving adapters (in)
  REST  |                   |  CLI, tests call the core
  ----> |   Application     | 
        |     Core          |  ports = interfaces the core OWNS
  <---- |   (domain)        | 
  DB    |                   |  driven adapters (out)
        +-------------------+  Postgres, Kafka, e-mail impl the ports
```

Two kinds of port: **driving/primary** (how the world calls in — REST controller, CLI, test harness) and **driven/secondary** (what the core calls out to — a `OrderRepository` interface implemented by a Postgres adapter). The rule that makes it work: **all dependencies point inward.** The domain defines `OrderRepository` and never imports JDBC; the Postgres adapter imports the domain. This means you can swap Postgres for DynamoDB, or drive the core from a test instead of HTTP, without touching domain logic. It's the Dependency Inversion Principle applied at the system boundary — the same idea as Clean/Onion architecture. In an LLD interview it's the clean way to answer "how would you keep the business rules independent of the database?"

### Q4. Explain dependency inversion at boundaries.

Dependency inversion says high-level policy shouldn't depend on low-level detail; both depend on an abstraction — and crucially, that abstraction is **owned by the high-level side**. At a boundary (say, persistence) the naive dependency points the wrong way:

```text
BEFORE:  OrderService  --->  PostgresOrderDao   (domain depends on the DB — inverted!)
```

Invert it: the domain declares the interface it *needs*, and the database implements it.

```java
// In the DOMAIN package — high-level, owns the abstraction
interface OrderRepository { void save(Order o); Optional<Order> find(Id id); }
class OrderService {
    private final OrderRepository repo;               // depends on OWN abstraction
    OrderService(OrderRepository repo) { this.repo = repo; }
}

// In the INFRASTRUCTURE package — low-level, depends on the domain
class PostgresOrderRepository implements OrderRepository { ... }
```

```text
AFTER:   OrderService  --->  OrderRepository  <---  PostgresOrderRepository
         (both point at the abstraction; the DB now depends on the domain)
```

Now the compile-time dependency flows *toward* the stable domain, not toward volatile infrastructure. Swap the database, mock it in tests, or add a caching decorator — the service is untouched. This is the mechanical heart of hexagonal architecture and the difference between DIP (the principle) and DI (the wiring that supplies the concrete repo at startup).

### Q5. How do you design a stable interface that won't churn?

Stable interfaces are **small, intention-revealing, and free of implementation leakage.** Design rules:

- **Model the client's need, not the provider's mechanism.** `OrderRepository.save(Order)` is stable; `saveWithJdbcBatch(Connection, Order)` leaks the implementation and will churn when the mechanism changes.
- **Keep it minimal (Interface Segregation).** Small role interfaces (`Readable`, `Closeable`) change less than fat ones; a client shouldn't depend on methods it never calls.
- **Use domain types, not vendor types, in the signature.** Don't put a `ResultSet` or an SDK class in a public method — it couples callers to the vendor.
- **Prefer values over flags.** Return a result object you can extend rather than a primitive you can't.
- **Design for extension via new methods with defaults** (Java default methods) so you can grow the interface without breaking implementers.
- **Version explicitly** when a breaking change is truly needed (`OrderRepositoryV2`, or additive-only evolution).

The mindset: a published interface is a contract with every current and future caller. The narrower and more domain-centric it is, the fewer reasons it has to change. Wide, mechanism-flavoured interfaces are the ones that churn.

### Q6. How do feature flags fit into designing for change?

Feature flags decouple **deploy** from **release**: you ship code dark, then flip behaviour on at runtime via config, per-user, or per-cohort — no redeploy. In OO terms a flag is an extension point evaluated at a decision boundary.

```java
class Checkout {
    private final Flags flags;
    Money total(Cart c) {
        Money t = baseTotal(c);
        if (flags.isOn("new-tax-engine", c.user())) t = newTaxEngine.apply(c);
        return t;
    }
}
```

Design guidance: keep the flag check at the *edge* (one branch that picks a Strategy), not smeared through the logic — ideally the flag chooses which implementation to inject, so the core stays flag-free. Flags enable canary/gradual rollout, kill switches, and A/B tests, and they let trunk-based teams merge unfinished work safely. The cost is real and worth naming in an interview: flags multiply the combinatorial state space (N flags = 2^N paths), rot into dead config, and become permanent if never retired. Treat each flag as debt with an expiry: track it, test both branches, and delete it once the feature is fully rolled out.

### Q7. What is an anti-corruption layer and when do you need one?

An anti-corruption layer (ACL) is a translation boundary that stops a foreign or legacy model from leaking into your domain. When you integrate with a third-party API, a legacy system, or another team's service, their concepts and data shapes are rarely yours — without a buffer, their model *corrupts* yours as its types and quirks spread through your code.

```text
   Your Domain            ACL (translator)          Foreign System
  +-----------+     +------------------------+     +----------------+
  |  Customer | <-- | LegacyCustomerAdapter  | <-- | CUST_REC (SOAP)|
  |  (clean)  |     | maps fields, units,    |     | quirky legacy  |
  +-----------+     | error codes -> domain  |     +----------------+
```

Concretely it's an Adapter/Facade pair: it calls the foreign API, then maps its DTOs, enums, error codes, and units into *your* domain types, so the rest of your code never sees the foreign shapes. You need one whenever you depend on a model you don't control and don't want spreading — legacy integrations, vendor SDKs, partner APIs, or during a strangler-fig migration where old and new coexist. The payoff: when the foreign system changes (or you replace it), the blast radius is the ACL, not your whole domain. It's a DDD term but a plain LLD technique — isolate the mess behind a translating boundary.

### Q8. How do you balance designing for change against YAGNI?

This is the central judgement call. **YAGNI** says don't build for imagined futures; **designing for change** says leave room to grow. They resolve with a simple discipline: *add abstraction when the variation is proven, not when it's imagined.*

Practical heuristics:

- **Rule of three.** Duplicate once, tolerate it; on the *third* occurrence you've seen the real axis of variation — now extract the abstraction. The second case is where you learn the shape; the first is a guess.
- **Design for change you can *name*, not change you can *imagine*.** "We already have a second payment provider on the roadmap" justifies a `PaymentGateway` interface today. "We might someday support other databases" usually doesn't.
- **Prefer cheap-to-add-later structure.** A single `if` is trivially refactored into a Strategy when the second case lands; a speculative plugin framework is expensive to *remove*. Under-abstraction is cheaper to fix than over-abstraction.
- **Watch for the speculative-generality smell** — abstract classes with one subclass, interfaces with one implementation, unused parameters "for flexibility." Those are YAGNI violations dressed as good design.

The senior answer: bias toward the simplest thing that works, keep seams where change is *demonstrated*, and refactor toward abstraction when the third case forces the issue — not before.

### Q9. What is speculative generality and why is it a smell?

Speculative generality is abstraction added for use cases that never arrive: an interface with a single implementation that will never have another, an abstract base class with one subclass, a method parameter nobody passes anything but the default to, or a plugin framework for a feature with one plugin. It's *designing for change* gone wrong — anticipating flexibility you don't need.

It's a smell because it isn't free: every speculative layer adds indirection, more files to navigate, more concepts to learn, and *more* coupling (callers now depend on an abstraction that buys them nothing). It makes the code harder to read and, ironically, harder to change, because the "flexible" structure has to be understood and maintained even though it never flexes. The Fowler refactoring is **Collapse Hierarchy** / **Inline Class** / **Remove Parameter** — delete the unused generality and go back to the concrete thing. The rule of thumb: an abstraction should earn its place with at least two real users. One implementation behind an interface, with no test seam and no named second case, is usually generality you should inline until a real need appears.

### Q10. How would you design a library that others extend?

Designing an extensible library is about publishing the *right* seams and nothing more. Principles:

- **Program to interfaces at the extension boundary.** Publish a small interface (`Codec`, `Filter`, `AuthProvider`) that plugins implement; keep the concrete engine internal.
- **Separate stable public API from volatile internals.** Use module boundaries / visibility (`exports` in JPMS, `internal` in Kotlin, package-private) so users can't couple to internals you'll change.
- **Provide a registration/discovery mechanism** — a Service Provider Interface (Java's `ServiceLoader`), a `register(Plugin)` call, or DI. The core discovers implementations without knowing their names.
- **Offer abstract skeletal base classes** (`AbstractHandler`) so implementers get boilerplate for free, while callers still depend on the interface.
- **Use Template Method / hooks** for "override this step" extension, and events/callbacks for "react to this" extension.
- **Design for backward compatibility from day one** — additive evolution, default methods, deprecate-then-remove, semantic versioning. A published interface is forever-ish.

```java
public interface Codec {                 // the seam users implement
    boolean supports(String type);
    byte[] encode(Object o);
}
// Core discovers all Codecs via ServiceLoader — never names a concrete one.
ServiceLoader.load(Codec.class).forEach(registry::add);
```

The mindset flip: for a library, *your users are your callers and your extenders*. Every public type is a contract, so keep the public surface small, the extension points explicit, and the internals firmly hidden.

### Q11. Design a notification system that supports adding new channels easily.

Requirements: send notifications over email, SMS, push — and adding a new channel (Slack, WhatsApp) should be a new class, not an edit to the core. This is OCP + Strategy + Factory.

Core objects: a `NotificationChannel` interface (the extension point), concrete channel adapters, a `NotificationService` that fans out, and a registry/factory that resolves channels by name.

```java
interface NotificationChannel {                 // extension point
    boolean supports(ChannelType type);
    void send(Notification n);
}
class EmailChannel implements NotificationChannel { ... }
class SmsChannel   implements NotificationChannel { ... }

class NotificationService {
    private final List<NotificationChannel> channels;   // injected/registered
    NotificationService(List<NotificationChannel> channels) { this.channels = channels; }

    void notify(User u, Notification n) {
        for (ChannelType t : u.preferredChannels())
            channels.stream().filter(c -> c.supports(t)).findFirst()
                    .ifPresent(c -> c.send(n));
    }
}
```

Adding Slack: write `SlackChannel implements NotificationChannel`, register it (DI, `ServiceLoader`, or a config list) — `NotificationService` is untouched. Extensions to mention: a `Decorator` for retry/rate-limiting around any channel, a `Template Method` for the shared send/log/metric flow, and an `Observer`/event bus so producers publish events and channels subscribe. The design keeps the core *closed* while the channel set stays *open*.

### Q12. What's the difference between dependency injection and dependency inversion?

They're related but different levels. **Dependency Inversion (DIP)** is a *principle*: depend on abstractions, and have the abstraction owned by the high-level module so dependencies point toward stable policy. **Dependency Injection (DI)** is a *mechanism/pattern*: supply a class's collaborators from outside (constructor, setter, or a container) rather than having it `new` them itself.

```java
// Dependency INVERSION — the principle: depend on an interface you own
class OrderService {
    private final PaymentGateway gateway;       // abstraction, not Stripe
    // Dependency INJECTION — the mechanism: gateway handed in, not new'd here
    OrderService(PaymentGateway gateway) { this.gateway = gateway; }
}
```

You can follow DIP without a DI framework (just pass interfaces into constructors manually — "poor man's DI"), and you can *use* DI to inject a concrete class and thereby *violate* DIP. So they're orthogonal in principle but usually travel together: DI is the most common way to *achieve* inversion of control, and Inversion of Control (IoC) is the broader umbrella — "don't call us, we'll call you" — of which DI is one instance. Interview-crisp version: DIP tells you *what* to depend on (abstractions), DI tells you *how* the dependency arrives (from outside).

### Q13. How do you refactor a growing switch statement into an extensible design?

A switch that gains a case with every new type is an OCP violation and a "replace conditional with polymorphism" candidate. The refactor moves each branch into a type that owns its behaviour.

```java
// BEFORE — every new payment method edits this method
Money fee(Payment p) {
    switch (p.type) {
        case CARD:   return p.amount.times(0.029);
        case BANK:   return Money.of(0.25);
        case CRYPTO: return p.amount.times(0.01);
    }
}
```

```java
// AFTER — polymorphism; new method = new class
interface PaymentMethod { Money fee(Money amount); }
class CardPayment   implements PaymentMethod { public Money fee(Money a){ return a.times(0.029);} }
class BankPayment   implements PaymentMethod { public Money fee(Money a){ return Money.of(0.25);} }
class CryptoPayment implements PaymentMethod { public Money fee(Money a){ return a.times(0.01);} }
```

Steps: (1) introduce the interface with the operation, (2) create a class per case, moving the branch body in, (3) replace the switch with a polymorphic call, (4) if construction still switches on a tag, isolate *that* in a single Factory/registry so there's one remaining place that maps tag→class. The one switch you can't fully eliminate — turning external input into an object — is fine to keep centralised. Caveat: only do this when the type set genuinely grows; a stable two-case switch may be clearer left as-is (YAGNI).

### Q14. What are seams, and why do they matter for change?

A **seam** (Michael Feathers' term) is a place where you can change behaviour *without editing in that place*. It's the unit of both testability and extensibility: at a seam you can substitute a different implementation — a mock in a test, a new strategy in production — by changing what's wired in, not by rewriting the code that uses it.

An interface with an injected implementation is the cleanest object seam:

```java
class ReportJob {
    private final Clock clock;         // seam: inject a fixed Clock in tests
    private final Mailer mailer;       // seam: inject a fake Mailer, assert sends
    ReportJob(Clock clock, Mailer mailer) { ... }
}
```

Without the seam, `ReportJob` would call `Instant.now()` and a real SMTP server directly — untestable and unchangeable without editing the class. With it, you alter behaviour from outside. Seams are why dependency injection, interfaces, and polymorphism matter for *change*: they're the same construct that makes code testable and makes it extensible. When someone asks "how would you make this testable/extensible?", the answer is almost always "introduce a seam" — extract the hard-coded dependency behind an interface and inject it.

### Q15. How does the Template Method pattern support extension?

Template Method defines the **skeleton of an algorithm** in a base method, deferring specific steps to subclasses via abstract or hook methods. The base *owns the flow* (closed to modification); subclasses fill the blanks (open for extension).

```java
abstract class DataImporter {
    public final void run() {          // the template — fixed order, final so it's not overridden
        var raw = read();              // step varies
        var clean = validate(raw);     // hook with a default
        save(clean);                   // step varies
    }
    protected abstract Data read();            // subclass must supply
    protected abstract void save(Data d);      // subclass must supply
    protected Data validate(Data d) { return d; } // hook — override optionally
}
class CsvImporter  extends DataImporter { protected Data read(){...} protected void save(Data d){...} }
class JsonImporter extends DataImporter { protected Data read(){...} protected void save(Data d){...} }
```

The extension mechanism is inheritance, but *disciplined*: the base fixes invariant structure and exposes named hooks, so a new importer can't accidentally reorder the pipeline — it can only customise the sanctioned steps. Contrast with Strategy, which achieves the same variation via composition (inject the step objects) and allows runtime swapping. Rule of thumb: Template Method when the varying steps are fixed at compile time and you want the base to enforce the algorithm's shape; Strategy when you want runtime flexibility or to avoid inheritance. Both are OCP tools — one extends by subclassing hooks, the other by composing strategies.

### Q16. When does adding an abstraction make a design worse rather than better?

Abstraction has a real cost — indirection, extra files, more concepts, and coupling to the abstraction itself — so it makes things worse whenever that cost isn't repaid by actual flexibility used. Concretely:

- **One implementation, no second case in sight** — an interface with a single implementer and no test seam is speculative generality; inline it.
- **Leaky abstraction** — if the interface exposes the very details it was meant to hide (a `Repository` returning `ResultSet`), it adds a layer *and* the coupling; strictly worse.
- **Wrong axis** — abstracting the thing that *doesn't* vary while the thing that *does* stays hard-coded. You pay the abstraction tax and still edit the core on every change.
- **Premature framework** — a plugin/registry mechanism for a feature with one plugin. Now every contributor learns the framework to add trivial behaviour.
- **Abstraction that obscures control flow** — five layers of indirection to follow one call path; readers can't tell what actually runs.

The test: an abstraction should reduce the *total* cost of the change it's designed to absorb. If removing it would make the code shorter and clearer with no loss of demonstrated flexibility, it's making the design worse. Under-abstraction is a cheap refactor away; over-abstraction has to be dismantled. Bias toward the concrete until a real, named second case earns the seam.

## Concurrency & Thread-Safety in OOD

### Summary

**What this topic covers**

This topic is the *design* angle on concurrency — how to shape a class so it's safe to share across threads — not the mechanics of locks, memory models, and executors (that lives in the Concurrency primer, and we link to it for the *how*). The 15 questions cover: designing **thread-safe classes** and where to draw the responsibility line; **immutable objects and value objects** as the default safe design; the **thread-safe Singleton** and its pitfalls; **confinement** and encapsulating state so it can't be touched unsafely; **guarded state** and how to *document* a class's thread-safety; the **Monitor Object** pattern; designing for **safe publication**; deciding **when a class should be thread-safe vs pushing that to the caller**; and treating **immutability as a design default**. The recurring theme: concurrency safety is largely an *encapsulation* problem. A class is thread-safe because it controls access to its own mutable state — so the OO tools (hide state, expose behaviour, immutability, composition) are exactly the tools that make concurrency tractable.

**Mental model**

Think of every mutable field as *shared state that needs a guardian*, and think of thread-safety as a property you either *design in* or *delegate*. Three strategies, in order of preference: (1) **don't share mutable state at all** — make the object immutable, and the whole problem evaporates (no writes, no races, free sharing); (2) **confine** the state — keep it thread-local or owned by a single thread so it's never shared; (3) if you must share mutable state, **encapsulate and guard it** — make the fields private, and let every path that touches them go through synchronization the class controls (the Monitor Object). The senior instinct is to reach for (1) first: immutable value objects are the cheapest correct concurrency design, and most "thread-safety bugs" are really "we shared a mutable object we shouldn't have." The second instinct is to be *explicit*: thread-safety is an invisible property, so a class must *state* whether it's safe, under what conditions, and which invariants the lock protects — otherwise callers guess, and guessing is where the data races live.

**Key terms**

- **Thread-safe class** — behaves correctly under concurrent access with no external synchronization, preserving its invariants.
- **Immutable object** — state fixed at construction; inherently thread-safe, freely shareable, safe as a map key.
- **Value object** — an object defined by its attributes (equality by value), typically immutable; no identity.
- **Confinement** — restricting state to a single thread (thread-local) or a single owning object so it's never shared.
- **Safe publication** — making an object visible to other threads *fully constructed*, via final fields, volatile, a concurrent collection, or a lock.
- **Guarded state** — mutable state protected by a stated lock; every access holds that lock ("guarded by").
- **Monitor Object** — a class that owns its mutable state *and* the lock protecting it; all public methods synchronize on it.
- **@GuardedBy / @ThreadSafe** — annotations/Javadoc documenting the concurrency contract of fields and classes.
- **Escaping reference** — leaking internal mutable state (returning a live collection, `this` from a constructor) that defeats encapsulation.
- **Effectively immutable** — mutable-typed but never mutated after safe publication; safe to share thereafter.
- **Stateless object** — holds no mutable instance state; trivially thread-safe.

**Why interviewers ask this**

Concurrency is where under-designed classes fail *in production, non-deterministically* — the worst kind of bug — so interviewers use it to see whether you think about sharing and state at *design* time rather than sprinkling `synchronized` afterwards. Juniors reach straight for locks; seniors first ask "does this need to be shared at all, and can I make it immutable so the question disappears?" The signal is knowing the *hierarchy* of strategies (immutability > confinement > guarded mutable state), being able to write a correctly-published thread-safe Singleton and explain why the naive double-checked-lock was broken, and — critically — knowing that thread-safety is a *documented contract*, not a vibe. Interviewers also probe the responsibility boundary: a mature engineer knows that making everything thread-safe is wasteful (uncontended locks, false comfort) and that sometimes the right design is a *clearly-documented not-thread-safe* class plus confinement, pushing synchronization to the one place that actually shares it.

**Common confusions**

- "Immutable means `final`" — `final` stops *reassignment* of the reference, not mutation of the referenced object; true immutability needs no mutators *and* no leaked mutable internals.
- "`synchronized` everywhere = thread-safe" — over-synchronizing kills throughput and still can't fix broken invariants or escaped references; correctness needs the *right* lock, not more locks.
- "Thread-safe class = thread-safe program" — compound actions across two thread-safe calls (check-then-act) can still race; atomicity is per-invariant, not per-method.
- "A `ConcurrentHashMap` field makes my class thread-safe" — only for single operations on that map; multi-field invariants still need class-level guarding.
- "Publishing an object is just assigning it" — without safe publication, other threads may see a partially-constructed object (the broken DCL Singleton).
- "Everything should be thread-safe to be safe" — no; confinement + immutability often means most classes *shouldn't* pay for synchronization.

**What follows from this topic**

This is where the primer's threads converge. **Immutability and value objects** came up in domain modelling and in composition-over-inheritance; here they become the *default concurrency strategy*. **Encapsulation** (hide state, expose behaviour) — the first OO principle — turns out to be the foundation of thread-safety: you can only guard state you control. The **Singleton** discussion connects to the creational patterns and their thread-safety footnotes, and **Monitor Object** is the concurrency-flavoured cousin of guarded classes. For the *mechanisms* — the Java memory model, `volatile`, `synchronized`, `Lock`, `AtomicInteger`, executors, and happens-before — this topic defers to the dedicated **Concurrency primer**; here the job is designing the *class* so those mechanisms have a clean, encapsulated place to live.

### Q1. What makes a class thread-safe, and what are your options for achieving it?

A class is thread-safe if it behaves correctly when accessed from multiple threads with no *external* synchronization — it preserves its invariants regardless of interleaving. The options, in order of preference:

- **Statelessness** — no mutable instance state means nothing to race on. A stateless service is trivially thread-safe. Cheapest option; reach for it first.
- **Immutability** — state fixed at construction, no mutators. Inherently safe, freely shareable. The default for value objects.
- **Confinement** — never share the mutable state: keep it thread-local, or confined inside a single owning object/thread. No sharing, no races.
- **Guarded mutable state** — if you *must* share mutable state, make it private and route every access through synchronization the class owns (the Monitor Object: `synchronized` methods or a private lock).
- **Delegation to thread-safe components** — build state out of `AtomicLong`, `ConcurrentHashMap`, etc., so they carry the safety — but only when a *single* such component holds the whole invariant.

```java
// Immutable — thread-safe by construction, no locks
final class Money {
    private final long cents;                 // final, set once
    Money(long cents) { this.cents = cents; }
    Money plus(Money o) { return new Money(cents + o.cents); } // returns a NEW object
}
```

The senior framing: don't ask "how do I lock this?" first; ask "can I make it immutable or confined so it doesn't *need* locking?" Locks are the last resort, not the first.

### Q2. Why is immutability the safest default for concurrent design?

Because an immutable object has no writes after construction, so there are no *mutations* to interleave — the entire category of data races on that object disappears. Multiple threads can read it simultaneously with zero synchronization, it can be shared and cached freely, and it's safe as a `HashMap` key (its hash never changes). You reason about it locally: its value can never surprise you because it never changes.

Requirements for true immutability (all needed):

- All fields `final` and set in the constructor.
- No mutator methods; "changes" return a *new* instance.
- The class is `final` (or sealed) so a subclass can't add mutable state or break the contract.
- No leaked mutable internals — defensively copy mutable inputs and outputs (a `Date` or `List` field must be copied in and never handed back live).

```java
final class Point {
    private final int x, y;
    Point(int x, int y) { this.x = x; this.y = y; }
    Point withX(int nx) { return new Point(nx, y); }   // functional "change"
}
```

The design payoff beyond concurrency: no aliasing bugs, failure atomicity, and trivially cacheable instances. The cost — allocation per "change" — is real but usually cheap and mitigable with structural sharing. In an interview: "make it immutable" is the strongest one-line answer to "how do you make this thread-safe?"

### Q3. What's the difference between an entity and a value object, and why does it matter for concurrency?

An **entity** has identity — it's the *same* thing over time even as its attributes change (a `Customer` with an ID; two customers with identical fields are still different customers). A **value object** has no identity — it's defined *entirely by its attributes*, so two value objects with equal attributes are interchangeable (`Money(500, USD)`, a `DateRange`, a `Color`). Value objects override `equals`/`hashCode` by value; entities compare by ID.

```java
record Money(long cents, Currency ccy) {}       // value object — equal by value, immutable
class Account {                                  // entity — equal by id, mutable state
    private final AccountId id;
    private Money balance;
    public boolean equals(Object o){ return o instanceof Account a && a.id.equals(id); }
}
```

Why it matters for concurrency: value objects are *naturally* immutable (a Money that changed its amount would be a different value), so they're thread-safe and shareable for free — make them immutable and you never think about them again. Entities *have* mutable state and lifecycle, so they're where thread-safety design actually happens: they need confinement, guarding, or careful publication. The design guidance falls out cleanly: model as much of your domain as possible as immutable value objects, and concentrate your concurrency effort on the small set of mutable entities that remain.

### Q4. Implement a thread-safe Singleton and explain the tradeoffs.

The cleanest thread-safe Singleton in Java is the **enum** — the JVM guarantees a single instance and handles publication and serialization for you:

```java
enum Config {
    INSTANCE;
    private final Map<String,String> values = load();
    String get(String k) { return values.get(k); }
}
```

If you need lazy initialization, use the **initialization-on-demand holder idiom** — the class loader guarantees thread-safe, lazy, lock-free init:

```java
class Registry {
    private Registry() {}
    private static class Holder { static final Registry INSTANCE = new Registry(); }
    static Registry get() { return Holder.INSTANCE; }   // Holder loads on first call
}
```

Tradeoffs and traps worth stating: the naive lazy `if (instance == null) instance = new ...()` is a **race** (two threads both see null). Synchronizing the whole getter fixes it but serializes every access. **Double-checked locking** needs the field to be `volatile` — without it, another thread can see a *non-null but partially constructed* instance (unsafe publication), which is the classic broken DCL. Beyond mechanics, remember Singleton is often an *anti-pattern*: it's global mutable state, it hides dependencies, and it makes testing hard (you can't swap it). Prefer a single instance *managed by a DI container* (one object, injected) over a hard-coded Singleton — you get "one instance" without the global.

### Q5. What is confinement and how does it help thread-safety?

Confinement means keeping mutable state reachable from **only one thread**, so it's never actually shared — and unshared state can't race, no locks required. It's often simpler and faster than guarding shared state.

Forms:

- **Thread confinement** — the state lives on one thread. `ThreadLocal<SimpleDateFormat>` gives each thread its own copy of a non-thread-safe object. Swing/UI toolkits confine all widget state to the event thread.
- **Stack confinement** — a local variable never escapes the method; only the executing thread can reach it. A mutable object created and used entirely within a method is automatically confined.
- **Instance confinement / encapsulation** — mutable state is `private` inside an object, and that object guards all access (a `Collections.synchronizedList` wrapping a private list; the Monitor Object). The state *is* shared, but only through the guardian.

```java
// Thread confinement — each thread gets its own non-thread-safe formatter
private static final ThreadLocal<DateFormat> DF =
    ThreadLocal.withInitial(() -> new SimpleDateFormat("yyyy-MM-dd"));
String format(Date d) { return DF.get().format(d); }   // no sharing → no lock
```

The design lesson: before synchronizing, ask "does this state *need* to be shared?" Often the right answer is "no — confine it," which removes the concurrency problem instead of managing it. The mechanism details of `ThreadLocal` and its leak risks belong to the Concurrency primer.

### Q6. What is the Monitor Object pattern?

The Monitor Object pattern makes an object responsible for **both** its mutable state and the lock that protects it: all public methods acquire the object's lock before touching state, so only one thread executes inside the object at a time and its invariants are always seen consistently. It's the OO packaging of "guarded mutable state" — the state and its guardian are the same object.

```java
class Counter {                          // a monitor object
    private long count = 0;              // state, private
    public synchronized void inc()  { count++; }        // every method holds the monitor lock
    public synchronized long get()  { return count; }
}
```

Structure: private mutable fields + every public method synchronized on a single lock (the intrinsic `this` monitor, or better a private `final Object lock`). Because all access serializes through that one lock, the class is thread-safe *and* callers need no external synchronization. Its cousin adds **condition waiting** — `wait()/notify()` (or a `Condition`) so methods can block until state permits (a bounded blocking queue: `put` waits while full, `take` waits while empty). That's the full Monitor Object: mutual exclusion *plus* cooperative scheduling, both encapsulated. Tradeoffs: simple and safe, but coarse-grained — one lock can become a bottleneck, and holding the monitor during long operations serializes everything. When contention matters you move to finer-grained locks or lock-free structures (Concurrency primer territory).

### Q7. What is safe publication and why does it matter for object design?

Safe publication is making a newly-constructed object visible to other threads *fully initialized* — so no thread can ever observe it in a half-built state. Without it, the memory model allows a thread to see the *reference* before it sees the object's field writes, so another thread can read default/garbage values from an object that "already exists."

```java
// UNSAFE publication — reader may see a non-null Holder with x still == 0
class Holder { int x; Holder(int x){ this.x = x; } }
Holder shared;                       // plain field
void publish() { shared = new Holder(42); }   // reference may become visible before x=42
```

Safe ways to publish (all establish the needed happens-before):

- Initialize from a **static initializer** (class-loading guarantees it).
- Store into a **`final` field** of a properly-constructed object (final-field freeze guarantee).
- Store into a **`volatile` field** or an `AtomicReference`.
- Store into a field **guarded by a lock** (write and read both hold it).
- Put into a **thread-safe/concurrent collection** (`ConcurrentHashMap`, `BlockingQueue`) — publication is built in.

Design implication: immutable objects are only guaranteed thread-safe *if published safely* (final fields give this automatically). This is exactly why the broken double-checked-lock Singleton needs `volatile` — plain assignment is unsafe publication. When you hand a mutable object to another thread, choose one of the safe channels above deliberately; don't assume "I assigned the field" is enough. Mechanism depth (happens-before, the JMM) is in the Concurrency primer.

### Q8. When should a class be thread-safe versus pushing that to the caller?

Not every class should be thread-safe — synchronization has costs (contention, reduced throughput, complexity) and false comfort. Decide by *who owns the sharing*:

**Make the class thread-safe when** it's *designed* to be shared — a cache, a connection pool, a registry, a Singleton service, anything whose whole job is to be a shared coordination point. Callers shouldn't have to know its locking scheme; encapsulate it (Monitor Object).

**Push it to the caller (document as not-thread-safe) when** the class is a plain data holder or a per-request/per-thread object that's *usually confined*. `ArrayList`, `HashMap`, `StringBuilder`, and most domain entities are deliberately *not* synchronized — because paying for locks on the 95% confined case to serve the 5% shared case is wasteful. The caller who actually shares one wraps it (`Collections.synchronizedList`) or confines it.

The decisive question: "Is sharing this object's mutable state *intrinsic to its purpose*, or incidental?" Intrinsic → make it thread-safe. Incidental → keep it simple, document `@NotThreadSafe`, and let the rare sharer synchronize. Either way, **state the contract explicitly** — the failure mode is an *undocumented* class where callers guess. A class that's clearly documented as not-thread-safe is a *better* design than one that's silently, partially safe.

### Q9. How do you document a class's thread-safety contract?

Thread-safety is invisible in a signature, so it *must* be documented — otherwise every caller reverse-engineers it and half get it wrong. Two tools:

**Class-level annotations / Javadoc** stating the guarantee — the JCIP annotations `@ThreadSafe`, `@NotThreadSafe`, `@Immutable` are the standard vocabulary:

```java
@ThreadSafe
public class BoundedCache<K,V> {
    @GuardedBy("this") private final Map<K,V> map = new LinkedHashMap<>();
    // @GuardedBy documents WHICH lock protects the field and its invariants
    public synchronized V get(K k) { ... }
    public synchronized void put(K k, V v) { ... }
}
```

**`@GuardedBy("lock")`** on each mutable field names the lock that must be held to touch it — this is the single most useful piece of concurrency documentation, because it turns "the locking is somewhere" into a checkable, tool-verifiable statement (static analyzers can flag accesses that don't hold the named lock).

What to document: (1) whether the class is thread-safe/immutable/not-safe; (2) *which* lock guards *which* state; (3) any compound operations the caller must synchronize externally (e.g. "iteration must be done while holding the instance lock"); (4) which methods are safe to call concurrently. The principle: a class's concurrency policy is part of its public contract, as much as its method signatures — write it down, don't leave it to be inferred.

### Q10. How do escaping references break thread-safety, and how do you prevent them?

An escaping reference leaks a class's internal mutable state to the outside, defeating the encapsulation that thread-safety depends on. If callers can reach the guarded state *without* going through your synchronization, no amount of internal locking saves you.

Common escapes:

```java
class Ledger {
    private final List<Entry> entries = new ArrayList<>();
    synchronized void add(Entry e) { entries.add(e); }
    List<Entry> getEntries() { return entries; }   // ESCAPE — caller mutates unguarded!
}
```

Also: publishing `this` from a constructor (registering a listener before construction finishes — other threads see a half-built object), or storing a caller-supplied mutable object by reference and assuming you own it.

Prevention — the same moves that enforce encapsulation:

- **Return copies or unmodifiable views**: `return List.copyOf(entries);` or `Collections.unmodifiableList`.
- **Defensively copy mutable inputs** on the way in: `this.date = new Date(date.getTime());`.
- **Never let `this` escape during construction** — no registering listeners, starting threads, or passing `this` to other objects in the constructor; use a factory method that constructs then publishes.
- **Prefer immutable field types** (`List.of`, records) so there's nothing to leak.

The through-line to the whole topic: thread-safety *is* encapsulation. You can only guard state that can't be reached behind your back, so the "hide state, expose behaviour" principle is literally what makes concurrency tractable.

### Q11. Design an in-memory rate limiter that's safe under concurrent access.

Requirements: `boolean allow(clientId)` returns whether a request is permitted, correct under many threads hitting it at once. Use a token-bucket per client, with per-client guarded state and a concurrent map to hold the buckets.

Core objects: a `RateLimiter` facade, a `TokenBucket` (the guarded mutable state), and a `ConcurrentHashMap<ClientId, TokenBucket>` confining each client's state to its own monitor.

```java
@ThreadSafe
class TokenBucket {                     // monitor object — owns its state + lock
    private final long capacity, refillPerSec;
    @GuardedBy("this") private double tokens;
    @GuardedBy("this") private long lastRefillNanos;

    synchronized boolean tryConsume() {
        refill();                       // add tokens for elapsed time
        if (tokens >= 1) { tokens -= 1; return true; }
        return false;
    }
    private void refill() {
        long now = System.nanoTime();
        tokens = Math.min(capacity, tokens + (now - lastRefillNanos)/1e9 * refillPerSec);
        lastRefillNanos = now;
    }
}
class RateLimiter {
    private final Map<ClientId, TokenBucket> buckets = new ConcurrentHashMap<>();
    boolean allow(ClientId id) {
        return buckets.computeIfAbsent(id, k -> new TokenBucket(...)).tryConsume();
    }
}
```

Design decisions worth stating: (1) each `TokenBucket` is a *Monitor Object* — its two fields form one invariant, so both are `@GuardedBy("this")` and `tryConsume` is atomic; per-field atomics wouldn't work because refill+consume is a compound action. (2) `ConcurrentHashMap.computeIfAbsent` gives atomic get-or-create so two threads for a new client don't build two buckets. (3) State is *partitioned per client*, so contention is per-bucket, not global — a scalability win. Mechanism depth (why `nanoTime`, memory visibility) links to the Concurrency primer; the *design* point is confinement + guarded compound state + a concurrent collection for the registry.

### Q12. What does "effectively immutable" mean and when is it useful?

An **effectively immutable** object is one whose type *allows* mutation but that is never actually mutated after it's **safely published** — so from the moment other threads can see it, it behaves like an immutable object and is safe to share without synchronization.

Example: a `Date` (mutable) or an `ArrayList` you populate once, then publish through a safe channel and never touch again:

```java
// mutable type, but never mutated after safe publication → effectively immutable
Map<String,String> config = new HashMap<>();
config.put("region", "eu");            // populate BEFORE publishing
publishSafely(config);                 // e.g. store in a volatile field / concurrent map
// from here on, no one mutates config → safe to share unsynchronized
```

It's useful when you can't make a type truly immutable (legacy classes, builder-populated collections, deserialized objects) but you *can* enforce a "build then freeze" discipline: fully initialize on one thread, publish safely, then treat as read-only. The catch — and the reason true immutability is preferred — is that "effectively" relies on *convention*: nothing stops a future maintainer from calling a mutator, and there's no compiler enforcement. So use it as a pragmatic step, but prefer real immutability (`final` fields, `List.copyOf`, records) where you can, because it makes the guarantee *structural* rather than a promise. Safe publication (Q7) is the load-bearing requirement — effectively immutable objects published *unsafely* are still racy.

### Q13. Why is `synchronized` on every method not enough to make a class thread-safe?

Because per-method locking only makes each *individual* call atomic — it does nothing for **compound actions** where a caller does check-then-act across two calls, and the state can change in the gap. A fully-synchronized class can still be misused into a race.

```java
@ThreadSafe class SafeMap<K,V> {                 // every method synchronized...
    private final Map<K,V> m = new HashMap<>();
    public synchronized boolean has(K k){ return m.containsKey(k); }
    public synchronized void put(K k, V v){ m.put(k, v); }
}
// ...yet THIS is still racy — two threads can both pass has() before either put()s:
if (!map.has(key)) map.put(key, value);          // check-then-act: not atomic!
```

Each method is atomic; the *sequence* isn't. Two threads interleave between `has` and `put`. Fixes: (1) provide a *compound* atomic operation on the class (`putIfAbsent`) so the whole check-then-act happens under one lock; (2) or have the caller hold the lock across both calls (client-side locking) — but that leaks the locking policy. This is why "thread-safe class ≠ thread-safe program" and why `ConcurrentHashMap` ships atomic `putIfAbsent`/`compute` methods rather than expecting callers to compose `containsKey`+`put`. Design lesson: identify the real *invariants and compound operations* your class must keep atomic, and expose *those* as methods — don't assume synchronizing each primitive method covers the combinations callers actually need. Over-synchronizing also hurts throughput without fixing this, so more locks isn't the answer; the *right-grained* atomic operation is.

### Q14. When would you deliberately design a class as NOT thread-safe?

Deliberately non-thread-safe is often the *correct* design — you choose it when the class is normally confined and paying for synchronization would be waste plus false comfort. Concretely:

- **Per-request / per-thread objects** — a request context, a builder, a parser instance used within one thread's call stack. Synchronizing them serves no one and slows the common path.
- **Plain data holders / DTOs and most domain entities** — `ArrayList`, `StringBuilder`, a `Cart` being assembled by one thread. The library authors chose non-thread-safe *on purpose*; the rare sharer wraps or confines it.
- **When the caller can synchronize more cheaply/coarsely** — if the enclosing operation already holds a lock or already confines the object, internal locking is redundant nested synchronization.
- **Performance-critical single-threaded sections** — locks add overhead and prevent optimizations even when uncontended.

The discipline that makes this safe: **document it loudly** (`@NotThreadSafe`) and pair it with a confinement strategy so it's *never* accidentally shared. The classic pattern is a non-thread-safe worker object confined to one thread, fronted by a thread-safe dispatcher that owns the sharing. This is the responsibility-boundary decision from Q8 in action: concentrate synchronization at the one point that genuinely shares state, and keep everything it delegates to simple and unsynchronized. A precisely-documented not-thread-safe class beats a vaguely-half-safe one every time.

### Q15. How does encapsulation underpin thread-safety, tying this back to core OO?

Thread-safety is, at bottom, an **encapsulation** problem — the very first OO principle (hide state, expose behaviour) is what *enables* every thread-safety strategy. You can only guarantee an invariant across threads if no thread can reach the state except through methods you control; the moment state escapes, your locking is bypassable and your guarantees are void.

Trace it through each strategy:

- **Immutability** works because fields are `private final` and no method mutates them — encapsulation ensures there's no back door to change state.
- **Guarded state / Monitor Object** works because fields are `private` and every access goes through synchronized methods — encapsulation *is* the guarantee that the lock is always held.
- **Confinement** works because the state is hidden inside one thread or one object and never handed out — encapsulation prevents the escape.
- **Escaping references break all of the above** precisely by *violating* encapsulation (Q10).

```java
@ThreadSafe class Account {
    @GuardedBy("this") private long balance;     // hidden state...
    public synchronized void deposit(long a){ balance += a; }  // ...reached only via behaviour
    public synchronized long balance(){ return balance; }
}
```

So the interview through-line: good OO design and good concurrency design are the *same discipline* viewed twice. Small, encapsulated classes with private state and behaviour-only interfaces — ideally immutable value objects — are both the cleanest OO *and* the safest concurrency. "Hide state, expose behaviour" isn't just about maintainability; it's the precondition that makes a class *possible* to reason about under concurrency at all.
## The LLD Interview Process

### Summary

**What this topic covers**

The *meta-skill* of low-level design interviews: not any single pattern, but the repeatable process that turns a vague prompt ("design a parking lot") into a clean, defensible object model inside 45 minutes. This topic has 16 questions covering the full arc: clarifying requirements and scoping, extracting entities/nouns and assigning responsibilities, mapping relationships (association / aggregation / composition), defining the public interfaces and APIs, choosing where GoF patterns earn their keep, coding the core classes, then handling edge cases, extensions, and concurrency. It also covers the *interview management* layer — how to drive the conversation, communicate trade-offs out loud, budget your time, and avoid the classic failure modes (jumping straight to code, over-engineering, or building the wrong thing because you skipped clarification). LLD is where OO fundamentals (encapsulation, SOLID, the 23 patterns) get applied under time pressure, so treat this topic as the connective tissue between the principles topics and the case-study topics.

**Mental model**

Think of an LLD interview as *progressive refinement*, not a single leap to the answer. You move down a ladder of abstraction: **requirements → nouns → responsibilities → relationships → interfaces → classes → code → edges**. Each rung constrains the next, and each is a checkpoint where you sync with the interviewer before descending. The most reliable framing is "nouns become classes, verbs become methods, adjectives become attributes or state" — a first-pass heuristic from CRC-card practice, not a law. The second framing: *design for the change the interviewer will ask for*. They will almost always follow up with "now add a second payment type / a third floor / a new vehicle size," so your job is to locate the axis of variation early and put a polymorphic seam there (Strategy, State, Factory). A design that absorbs the follow-up with a new subclass instead of an `if`-branch is the whole game. You are being watched for *how you think*, not whether you memorized a canonical parking-lot solution.

**Key terms**

- **Requirement clarification** — the 3-5 minutes up front where you turn an open prompt into a bounded, in-scope problem with explicit assumptions.
- **Functional vs non-functional requirements** — what the system *does* (park a car, issue a ticket) vs its *qualities* (thread-safe, extensible, low latency).
- **Noun extraction** — pulling candidate classes/entities out of the requirements text.
- **Responsibility** — a single reason a class exists; the unit you assign via CRC cards / SRP.
- **CRC card** — Class–Responsibility–Collaborator; a lightweight tool for allocating behavior before drawing UML.
- **Public interface / API** — the method signatures other objects depend on; designed before internals.
- **Axis of variation** — the dimension the design must flex along; where you place a pattern seam.
- **Core flow** — the one end-to-end scenario (e.g. "park then pay then exit") you code first.
- **LLD vs HLD** — class/object level (this primer) vs distributed/service/architecture level (the separate System Design primer).
- **Over-engineering** — adding patterns, layers, or generality the stated requirements never asked for (YAGNI violation).
- **Driving** — you, not the interviewer, narrating the next step and proposing the direction.

**Why interviewers ask this**

LLD rounds separate engineers who can *model a domain* from engineers who can only *implement a spec someone else modeled*. Junior candidates open their editor and start typing a `Car` class; senior candidates spend the first five minutes asking what "parking lot" even means here — one lot or many, payment or free, real-time availability or not. The signal is *disciplined ambiguity reduction*: can you take a deliberately under-specified prompt, state assumptions, scope aggressively, and still deliver a coherent object model? Interviewers also read *communication* — are you narrating trade-offs ("I'll use State here rather than an enum + switch because the follow-up will add statuses"), or silently coding? And they probe *judgment*: a candidate who reaches for Abstract Factory on a two-class problem fails the YAGNI test as surely as one who hard-codes everything. Getting the process right is often worth more than getting the "perfect" design.

**Common confusions**

- "LLD is HLD but smaller" — no; HLD is about services, data stores, and network boundaries, LLD is about classes and their interactions inside one process. Different vocabulary, different diagrams.
- "Start coding immediately to show speed" — coding before scoping is the top failure mode; it signals you can't handle ambiguity.
- "More patterns = better design" — patterns are liabilities until a requirement justifies them; unused flexibility is just complexity.
- "The UML has to be perfect and complete" — a partial, correct class diagram beats an exhaustive wrong one; UML is a communication aid, not the deliverable.
- "Concurrency is optional / an afterthought" — for shared-mutable designs (parking availability, seat booking) the interviewer *expects* you to at least flag the race and name a mitigation.

**What follows from this topic**

This process is the scaffold for both case-study topics. The **relationships** step draws directly on the aggregation-vs-composition and UML material; the **apply patterns** step is where every GoF pattern from the patterns topics gets its audition; the **interfaces before implementation** step is Dependency Inversion in practice. Master the loop here and the case studies (LLD Case Studies I & II) become mechanical: parking lot, elevator, vending machine, ATM, chess — all the same eight steps with different nouns.

### Q1. Walk me through your step-by-step approach to any low-level design question.

I use an eight-step loop, and I say the step names out loud so the interviewer can steer me:

1. **Clarify requirements & scope** — turn the open prompt into a bounded problem. Functional (what it does) and non-functional (thread-safety, extensibility). State assumptions explicitly.
2. **Identify entities / nouns & responsibilities** — extract candidate classes from the requirements, assign each a single responsibility (CRC cards in my head).
3. **Map relationships** — how do the classes connect? Association, aggregation, composition, inheritance. Draw a rough UML class diagram.
4. **Define public interfaces / APIs** — the method signatures each class exposes. Design these before internals so I'm programming to interfaces.
5. **Apply patterns where they earn it** — locate the axis of variation and drop in Strategy / State / Factory / Observer *only* where a requirement justifies it.
6. **Code the core classes** — implement the one primary end-to-end flow, not every class. Skeletons for the rest.
7. **Handle edge cases & extensions** — nulls, empties, concurrency limits, and the "now add X" follow-up.
8. **Discuss concurrency / thread-safety** — where is shared mutable state, what's the race, how do I guard it.

The discipline is *checkpointing*: after step 1 and step 3 I pause and confirm before going deeper. The first two steps are where interviews are won or lost — most weak candidates skip straight to step 6.

### Q2. How do you spend the first five minutes clarifying requirements? What do you actually ask?

I bucket questions into functional, non-functional, and scope-boundary. For "design a parking lot":

- **Functional**: Multiple vehicle sizes (motorcycle / car / truck)? Do we charge, and is pricing flat or time-based? Do we track real-time availability? Multiple entry/exit gates? Reserved spots / handicapped spots?
- **Non-functional**: Single process or distributed? Do we need thread-safety for concurrent entries? Expected scale (10 spots or 10,000)?
- **Scope boundaries**: Are we designing *just* the in-memory object model, or also persistence and a REST API? (Usually just the object model.)

Then I *state assumptions and lock scope*: "I'll assume one physical lot, three vehicle sizes, time-based pricing, concurrent gates, in-memory only — I'll leave out persistence and admin dashboards. Sound right?" This does three things: shows I distinguish must-have from nice-to-have, gives the interviewer a chance to redirect cheaply, and creates a written contract I can point back to. The worst outcome is designing the wrong system beautifully — clarification is insurance against that.

### Q3. How do you go from a requirements description to a set of classes?

The classic heuristic is grammatical: **nouns → classes/attributes, verbs → methods, adjectives → state or attributes**. From "a customer parks a vehicle in a spot and receives a ticket," the nouns *Customer, Vehicle, Spot, Ticket* are class candidates; *parks* and *receives* are methods; *available* (spot) is state.

Then I filter the noun list — not every noun is a class:

- **Keep** nouns with identity, state, and behavior → `Vehicle`, `ParkingSpot`, `Ticket`.
- **Demote** nouns that are just attributes → "license plate" is a field on `Vehicle`, not a class.
- **Merge** synonyms → "slot" and "spot" are one class.
- **Promote value concepts** → "money" / "price" becomes a `Money` value object, not a raw `double`.

Finally I assign responsibilities with CRC-card thinking: for each class, one line answering "what is this class responsible for, and who does it collaborate with?" If a class has two unrelated reasons to change, I split it (SRP). This gives me a responsibility-balanced object model before I write a single method body.

```text
Class: ParkingLot        Responsibilities: find spot, admit vehicle, issue ticket
                         Collaborators: ParkingSpot, Ticket, PricingStrategy
Class: ParkingSpot       Responsibilities: know size, know if occupied, hold vehicle
                         Collaborators: Vehicle
```

### Q4. Once you have classes, how do you decide the relationships between them?

I ask, for each pair, "what kind of link is this, and who owns whose lifecycle?" The four relationships and their UML notation:

| Relationship | Meaning | Lifecycle | UML |
|---|---|---|---|
| Association | "uses-a" | independent | `-->` |
| Aggregation | "has-a" (shared) | parts outlive whole | `o--` |
| Composition | "owns-a" (exclusive) | parts die with whole | `<>--` |
| Inheritance | "is-a" | n/a | `<|--` |

Concretely for the parking lot: a `ParkingLot` **composes** its `ParkingSpot`s (destroy the lot, the spots are meaningless — filled diamond). A `ParkingSpot` **aggregates** a `Vehicle` (the car exists before and after it parks — hollow diamond). A `Truck` **is-a** `Vehicle` (inheritance). The `ParkingLot` **uses** a `PricingStrategy` (association/dependency).

```text
+-----------+       +-------------+       +---------+
| ParkingLot| <>--- | ParkingSpot | o---> | Vehicle |
+-----------+       +-------------+       +---------+
                                              ^
                                              |  <|--
                                    +---------+---------+
                                    | Car  Truck  Motorcycle
```

The key discipline: **prefer composition/aggregation over inheritance**. I only draw an inheritance arrow when there's a true "is-a" that satisfies Liskov substitution; otherwise I model "has-a" and delegate.

### Q5. Why design the public interfaces before the internal implementation?

Because it forces **Dependency Inversion** and keeps the design decoupled. If I define `interface PaymentProcessor { PaymentResult charge(Money amount); }` first, the rest of the system depends on that abstraction, and I can slot in `CreditCardProcessor`, `CashProcessor`, or a test double without touching callers. If I code the concrete class first, callers end up coupled to its internals.

Interface-first also front-loads the *hard* design decisions — method names, parameters, return types, and error signaling — while they're cheap to change (no implementation to rewrite). And it lets me sketch the whole system as collaborating interfaces on the whiteboard, then fill bodies in only for the core flow. In the interview I literally write the interfaces as a block:

```java
interface PricingStrategy { Money price(Duration parked, VehicleSize size); }
interface ParkingLot { Ticket park(Vehicle v); Receipt exit(Ticket t); }
interface PaymentProcessor { PaymentResult charge(Money amount); }
```

Now the interviewer can see the shape of the system in ten lines, and "add a new payment type" is visibly a matter of one new implementation. Program to an interface, not an implementation.

### Q6. When and how do you decide to apply a design pattern during LLD?

Patterns are a *response to a requirement for variation*, never a starting point. My rule: **don't reach for a pattern until a requirement forces an axis of change.** The trigger is usually a follow-up-shaped question — "what if there are multiple payment methods / pricing schemes / vehicle behaviors?"

The mapping I keep in my head:

| Requirement smell | Pattern |
|---|---|
| "Multiple interchangeable algorithms" (pricing, payment) | **Strategy** |
| "Object behaves differently by lifecycle status" (elevator moving/idle) | **State** |
| "Create objects without naming concrete class" | **Factory Method** / Simple Factory |
| "Notify many observers of a change" (availability display) | **Observer** |
| "Build a complex object step by step" | **Builder** |
| "Exactly one shared instance" (a real, justified singleton) | **Singleton** |
| "Add behavior without subclass explosion" | **Decorator** |

I say the trade-off out loud: "I'll model the elevator's moving/idle/maintenance behavior with the **State** pattern rather than an enum plus a switch, because the follow-up will add a new status and State makes that a new class instead of editing every switch — that's Open/Closed." Naming *why not the alternative* (State vs enum+switch, Strategy vs if/else chain) is what reads as senior. And I explicitly resist patterns that aren't earned — no Abstract Factory on a single-product problem.

### Q7. How is low-level design (LLD) different from high-level / system design (HLD)?

They operate at different altitudes and answer different questions.

| | LLD (this primer) | HLD / System Design |
|---|---|---|
| Unit | Classes, objects, methods | Services, databases, queues |
| Concern | Responsibilities, relationships, patterns | Scalability, availability, partitioning |
| Diagram | UML class / sequence diagram | Boxes-and-arrows architecture diagram |
| Vocabulary | SOLID, GoF patterns, inheritance | Load balancing, sharding, CAP, caching |
| Question | "Design the parking-lot classes" | "Design a system to handle 1M parkings/day" |
| Failure mode | God class, wrong relationships | Single point of failure, no scaling story |

A concrete lens: in HLD, "PaymentService" is a box that talks to a database over the network. In LLD, `PaymentService` is a class with a `PaymentStrategy` field and a `charge()` method, and I care about its internal object graph. The same interview prompt ("design Uber") can be run at either altitude. In an LLD round I stay inside one process and talk about classes and patterns; the moment I start drawing Kafka topics and read replicas, I've drifted into the wrong interview. Note: distributed *architecture* patterns (CQRS, saga, load balancing) belong to the System Design primer, not here.

### Q8. How do you manage your time in a 45-minute LLD interview?

Rough budget, adjusted live:

- **0-5 min — Clarify & scope.** Requirements, assumptions, lock the boundary.
- **5-15 min — Model.** Nouns → classes → responsibilities → relationships. Draw the UML class diagram.
- **15-20 min — Interfaces & patterns.** Public APIs, identify the variation axes, name the patterns.
- **20-35 min — Code the core flow.** Implement the one primary scenario end-to-end; skeleton the rest.
- **35-42 min — Edge cases, extensions, concurrency.** Handle the "now add X" follow-up, flag races.
- **42-45 min — Recap & trade-offs.** Summarize the design and what I'd do with more time.

The two anti-patterns are spending 25 minutes on requirements (analysis paralysis) or 2 minutes (building the wrong thing). I also **don't try to code every class** — that's a time sink. I implement the core flow to demonstrate the design works, and I say "the other classes follow the same pattern, I'll skeleton them." Leaving five minutes for extensions is deliberate: the follow-up is where senior signal lives, and running out of clock before it is a self-inflicted wound.

### Q9. How do you communicate and "drive" during the interview instead of waiting to be led?

Driving means *I* propose the next step and narrate the reasoning; the interviewer corrects rather than pulls. Concretely:

- **Announce the step**: "I've got the classes — let me map relationships now." The interviewer always knows where we are.
- **Think out loud**: "I'm choosing composition here because a spot has no meaning outside its lot." Silent design is unreadable.
- **Offer options, then pick one**: "I could use an enum for vehicle size or a class hierarchy. Enum is simpler and sizes are fixed, so I'll go enum unless you want per-type behavior — then I'd subclass." Showing you *considered* the alternative and *chose* is the signal.
- **Checkpoint**: "Before I code, does this class breakdown look right to you?"
- **Timebox yourself aloud**: "That's a good extension — let me finish the core flow first, then come back to it."

The failure mode is treating it as an exam where you wait for questions. LLD is collaborative design; the interviewer is a stand-in for a teammate. A candidate who drives, narrates trade-offs, and adapts to hints scores far above one who silently produces a technically-correct diagram.

### Q10. What are the most common mistakes candidates make in LLD interviews?

Five recurring ones, roughly in order of how often they sink candidates:

1. **Jumping straight to code.** Opening the editor and typing a `Car` class before scoping. Signals you can't handle ambiguity. Fix: always spend the first five minutes on requirements.
2. **Ignoring requirements / building the wrong thing.** Designing a distributed payment system when they asked for a single-lot object model. Fix: state assumptions and lock scope explicitly.
3. **Over-engineering.** Abstract Factory, plugin architectures, and six layers of indirection on a problem that needs three classes. Violates YAGNI. Fix: add patterns only when a requirement forces variation.
4. **God class.** One `ParkingLotManager` that finds spots, computes price, processes payment, and prints tickets. Violates SRP. Fix: distribute responsibilities; each class one reason to change.
5. **Silent design / no trade-off talk.** Producing a correct diagram with zero narration. The interviewer can't distinguish understanding from luck. Fix: verbalize every choice and its alternative.

Honorable mentions: forgetting concurrency entirely on a shared-state problem, and getting aggregation vs composition backwards. Any one of these is survivable; two or three together fail the round.

### Q11. What does over-engineering look like in LLD, and how do you avoid it?

Over-engineering is paying for flexibility no requirement asked for. Tells: an interface with exactly one implementation and no second one on the horizon; a Factory that only ever produces one type; a Strategy for an algorithm that will never vary; generics and reflection where a simple type would do; five layers (controller → service → manager → helper → repository) for a CRUD operation.

The antidote is **YAGNI + "make the change easy, then make the easy change."** I design for the variation the requirements *actually* imply, not every variation imaginable. If pricing is stated as flat-rate with no hint of change, I use a constant, not a `PricingStrategy` hierarchy — but I mention "if pricing becomes variable, this is where Strategy slots in." That sentence shows I *know* the pattern and *chose* not to prematurely apply it, which reads as more senior than actually applying it.

```java
// Over-engineered for "flat $5 parking":
interface PricingStrategy { Money price(...); }
class FlatPricingStrategy implements PricingStrategy { ... }
class PricingStrategyFactory { ... }

// Right-sized:
Money price = Money.of(5);  // "if pricing varies later, extract PricingStrategy here"
```

Simplicity is a feature. The best design is the smallest one that satisfies the requirements and has a clear seam for the change the interviewer is likely to request.

### Q12. How do you handle edge cases and extensions once the core design is done?

I split "edge cases" (correctness of the current design) from "extensions" (future requirements), and I address them in that order.

**Edge cases** — I walk the core flow and ask "what breaks?": lot is full (return `Optional.empty()` / throw a domain exception, not null), invalid/lost ticket, vehicle already parked, payment declined, exit without entry. I show these as guard clauses at the top of the relevant methods.

**Extensions** — I demonstrate the design *absorbs change*. The interviewer will ask "now add electric-vehicle charging spots" or "add monthly-pass pricing." A good design answers with a new subclass or a new Strategy implementation, not by editing existing classes:

```java
// Extension: new pricing scheme = new class, zero edits to ParkingLot (Open/Closed)
class MonthlyPassPricing implements PricingStrategy {
    public Money price(Duration d, VehicleSize s) { return Money.ZERO; }
}
```

If adding the feature requires touching five existing classes, I say so honestly and explain what I'd refactor. Gracefully absorbing the extension is the payoff for having placed the pattern seams correctly in step 5 — it's the moment the earlier discipline pays off.

### Q13. When and how do you bring up concurrency and thread-safety in an LLD design?

I bring it up as an explicit step *after* the single-threaded design works, but only if the domain has shared mutable state — which parking lots, seat booking, elevators, and rate limiters all do. Raising it unprompted on a genuinely single-threaded design is over-engineering.

The reasoning I narrate: "Two cars can arrive at two gates simultaneously and both be assigned the last free spot — that's a check-then-act race on shared state." Then I name mitigations at the right granularity:

- **Immutability** for value objects (`Ticket`, `Money`) — inherently thread-safe, share freely.
- **Fine-grained locking** — synchronize the spot-assignment critical section, or lock per-floor rather than a global lock, to preserve throughput.
- **Concurrent data structures / atomics** — an `AtomicInteger` free-spot counter, or a `ConcurrentHashMap` of spots.
- **Compare-and-set** — atomically flip a spot from FREE to OCCUPIED so only one thread wins.

```java
// The race and its guard
synchronized (lot) {                 // or lock per floor for throughput
    ParkingSpot spot = lot.findFree(size);
    if (spot == null) throw new LotFullException();
    spot.occupy(vehicle);            // check-then-act now atomic
}
```

I keep it light and correct — the interviewer wants to see that I *recognized* the shared state and can name a defensible guard, not a full lock-free implementation. This is where the design links to the Concurrency primer.

### Q14. How do CRC cards help, and would you actually use them in an interview?

CRC = **Class, Responsibility, Collaborator**. Each card names one class, lists its responsibilities (what it knows and does), and lists its collaborators (who it talks to). They're a low-tech way to allocate behavior *before* committing to UML or code, and they naturally enforce SRP — if a card's responsibility list has two unrelated bullets, split the class.

In an interview I don't draw literal index cards, but I *think* in CRC terms and often write a compact version on the board:

```text
ParkingLot     | admit vehicle, find spot, issue ticket   | Spot, Ticket, Pricing
ParkingSpot    | know size + occupancy, hold vehicle       | Vehicle
Ticket         | record entry time + spot                  | -
PricingStrategy| compute fee from duration + size          | -
```

The value is *responsibility balancing*: it surfaces god classes (too many responsibilities on one card) and feature envy (a class whose responsibilities really belong to a collaborator) before I've written code that's expensive to move. It also directly seeds the relationships step — the "Collaborators" column *is* the association list. I mention them because reaching for CRC signals I've internalized responsibility-driven design rather than just noun-spotting.

### Q15. Show a small before/after where following the process changes the design.

Take "design a notification sender for email and SMS." A candidate who skips the process writes a god method:

```java
// Before — jumped to code, ignored the variation axis
class NotificationSender {
    void send(String type, String to, String msg) {
        if (type.equals("email")) { /* SMTP logic */ }
        else if (type.equals("sms")) { /* SMS gateway logic */ }
        // adding "push" means editing this method — Open/Closed violation
    }
}
```

Running the process: step 2 identifies the *noun* `Notification` and the *variation axis* "channel"; step 5 recognizes "multiple interchangeable ways to deliver" → **Strategy** (or polymorphic subtypes):

```java
// After — variation axis became a polymorphic seam
interface NotificationChannel { void send(String to, String msg); }
class EmailChannel implements NotificationChannel { public void send(...) { /* SMTP */ } }
class SmsChannel   implements NotificationChannel { public void send(...) { /* gateway */ } }

class NotificationSender {
    private final NotificationChannel channel;
    NotificationSender(NotificationChannel channel) { this.channel = channel; }
    void send(String to, String msg) { channel.send(to, msg); }   // no if/else
}
```

Adding push notifications is now a new class, zero edits to `NotificationSender` — Open/Closed satisfied, and the `if/else` chain is gone. Same requirements, but the process routed me to the seam. That's the entire value of the eight steps: they reliably surface where the design must flex.

### Q16. What should you say in the final recap, and what if you run out of time?

The recap (last 2-3 minutes) should re-anchor the interviewer on the *shape* of the design and demonstrate self-awareness:

1. **One-sentence summary of the object model** — "So: `ParkingLot` composes `Spot`s, uses a `PricingStrategy` and `PaymentProcessor`, and issues immutable `Ticket`s."
2. **Where the seams are** — "New vehicle types, pricing schemes, and payment methods each plug in as a subclass/strategy without touching existing code."
3. **Known limitations & next steps** — "I kept it single-lot and in-memory; with more time I'd add the concurrency guards on spot assignment and a persistence layer behind a repository interface."

If I'm running out of time mid-design, I *prioritize breadth over depth*: get every core class named and related on the board (even as empty skeletons) so the whole model is visible, rather than perfecting one class while others are missing. A complete-but-shallow design communicates far more than a deep-but-partial one. And I say what I'd do next — showing I *know* what's unfinished is itself a positive signal. Never end silently; always land the plane with a recap.

## LLD Case Studies I

### Summary

**What this topic covers**

Five fully-worked object designs — the ones that come up most in real LLD rounds: **parking lot, elevator system, vending machine, ATM, and library management system**. This topic has 16 questions. Each case study runs the same loop from *The LLD Interview Process*: requirements → core classes & responsibilities → UML class diagram → key GoF patterns → code skeleton → extensions & edge cases. The point is not to memorize five canned solutions but to see the *patterns recur*: the vending machine and elevator both hinge on **State**; pricing and payment across all five are **Strategy**; object creation is **Factory**; a genuinely-single shared resource justifies **Singleton**. By the end you should recognize that "design an X" prompts are variations on a handful of modeling moves, and you should be able to defend *which pattern and why* for each.

**Mental model**

Read each case study as "find the varying dimension, then name the pattern that isolates it." In a **vending machine**, behavior changes with the machine's status (idle → collecting money → dispensing) — that's a lifecycle, so **State**. In an **elevator**, the *scheduling decision* (which request to serve next) is the thing that varies and that you'd want to swap — that's an algorithm, so **Strategy**, while the car's moving/idle/maintenance behavior is **State**. Across **all** of them, *how you charge* (cash, card, coins) and *how you price* vary independently of the core flow — **Strategy** again, sometimes behind a **Factory**. The second mental habit: distinguish the *entities* (things with identity and state — `Account`, `Book`, `ParkingSpot`) from the *services/controllers* (things that orchestrate — `ATM`, `ParkingLot`, `LibraryManager`) from the *value objects* (immutable descriptors — `Money`, `Ticket`, `Address`). Getting that three-way split right prevents the god-class failure mode more than any single pattern does.

**Key terms**

- **Entity** — an object with identity and a lifecycle (`Account`, `Member`, `Elevator`).
- **Value object** — immutable, equality-by-value (`Money`, `Ticket`, `BookCopy` id).
- **Controller / service** — orchestrates a use case (`ParkingLot.park()`, `ATM.withdraw()`).
- **State pattern** — encapsulate status-dependent behavior in state classes; the object delegates to its current state.
- **Strategy pattern** — encapsulate interchangeable algorithms (pricing, payment, elevator scheduling) behind an interface.
- **Factory** — centralize creation of related objects (spot by size, product by code).
- **Singleton** — one shared instance; justified only for a truly unique resource, used sparingly.
- **Enum with behavior** — a lightweight alternative to a class hierarchy for a small fixed set (vehicle size, coin denomination).
- **Command** — encapsulate a request as an object (an elevator floor request, an ATM transaction).
- **Repository / registry** — abstraction over a collection of entities (`BookCatalog`, `AccountStore`).
- **Guard clause** — early-return precondition check for edge cases (lot full, insufficient balance).

**Why interviewers ask this**

These five are the canonical "can you model a bounded domain under time pressure" prompts. They're small enough to finish in 45 minutes but rich enough to expose whether you understand *responsibility distribution* and *pattern selection*. The vending machine and elevator specifically test **State**, which trips up candidates who default to an enum + giant switch statement (and thereby violate Open/Closed). The ATM and parking lot test whether you can keep a controller thin and push behavior onto entities, versus building a god class. The library test whether you model relationships (member ↔ loan ↔ copy) and lifecycle (available → borrowed → overdue) cleanly. Senior signal is *justifying* each pattern ("State here because the follow-up adds a status," "Singleton *not* here because it hurts testability") rather than name-dropping. Junior candidates produce data-bag classes with all logic in one manager; seniors distribute behavior and defend it.

**Common confusions**

- "Vending machine = enum + switch on status" — that's the anti-pattern State exists to fix; every new status forces edits to every switch.
- "Everything shared should be a Singleton" — Singleton hurts testability and hides dependencies; use it only for a genuinely unique resource, and prefer injecting one instance.
- "Elevator scheduling is just FCFS" — the interesting design is making the scheduling algorithm swappable (Strategy: FCFS vs SCAN/elevator algorithm).
- "The ATM class does everything" — a fat `ATM` that validates PINs, checks balance, dispenses cash, and prints receipts is a god class; split into entities and a thin controller with State for the session.
- "Money is a double" — floating-point money is a classic bug; use a `Money` value object with integer minor units.

**What follows from this topic**

These five establish the recurring moves — State for lifecycle, Strategy for pricing/payment/scheduling, Factory for creation, thin controller over rich entities. *LLD Case Studies II & Playbooks* reuses every one of them on board games (State for game status, Strategy for player), LRU cache (data-structure design), rate limiter (Strategy for algorithm), logger (Chain of Responsibility), pub/sub (Observer), and Splitwise (Strategy for split type), then closes with a strategy playbook for reasoning out loud. Nail the pattern-recognition here and the second set is the same skill on new nouns.

### Q1. Design a parking lot. Walk through requirements, classes, patterns, and the core code.

**Requirements** (after clarifying): one lot, multiple floors, three vehicle sizes (motorcycle/car/truck), spots sized to fit, time-based pricing, multiple entry/exit gates (so concurrency matters), in-memory only.

**Core classes & responsibilities**: `ParkingLot` (admit/exit, find spot — thin controller), `ParkingFloor` (holds spots for one level), `ParkingSpot` (size, occupancy, held vehicle), `Vehicle` (abstract; `Car`/`Truck`/`Motorcycle`), `Ticket` (immutable: entry time, spot), `PricingStrategy` (interchangeable fee calc), `PaymentProcessor` (interchangeable payment).

**UML**:

```text
+-----------+ <>--- +--------------+ <>--- +-------------+ o---> +---------+
| ParkingLot|       | ParkingFloor |       | ParkingSpot |       | Vehicle |
+-----------+       +--------------+       +-------------+       +---------+
     |                                                               ^ <|--
     | uses                                             Car  Truck  Motorcycle
     v
+-----------------+        +------------------+
| PricingStrategy |        | PaymentProcessor |   (both interfaces -> Strategy)
+-----------------+        +------------------+
```

**Patterns**: **Strategy** for `PricingStrategy` and `PaymentProcessor` (the axes of variation), **Factory** to create the right `Vehicle`/spot, **enum** `VehicleSize` for the fixed set. No Singleton — I'd inject one `ParkingLot`.

**Core code**:

```java
enum VehicleSize { MOTORCYCLE, CAR, TRUCK }
abstract class Vehicle { abstract VehicleSize size(); }
class Car extends Vehicle { VehicleSize size() { return VehicleSize.CAR; } }

interface PricingStrategy { Money price(Duration d, VehicleSize s); }

class ParkingLot {
    private final List<ParkingFloor> floors;
    private final PricingStrategy pricing;

    Ticket park(Vehicle v) {
        ParkingSpot spot = findSpot(v.size())
            .orElseThrow(() -> new LotFullException(v.size()));
        spot.occupy(v);
        return new Ticket(spot, Instant.now());
    }
    Receipt exit(Ticket t, PaymentProcessor payment) {
        Money fee = pricing.price(Duration.between(t.entryTime(), Instant.now()), t.spot().size());
        payment.charge(fee);
        t.spot().vacate();
        return new Receipt(fee);
    }
}
```

**Extensions/edges**: lot full (guard clause), lost ticket, EV charging spots (new spot subtype), reserved/handicapped (new `SpotType`). **Concurrency**: two gates racing for the last spot — synchronize the find-and-occupy critical section (per-floor lock for throughput).

### Q2. Why is the State pattern the right fit for a vending machine, and how do you structure it?

A vending machine's behavior depends entirely on *what state it's in*: in `IdleState`, inserting money is valid but pressing dispense is not; in `HasMoneyState`, selecting a product is valid; in `DispensingState`, everything else is rejected. The naive design is an enum plus a giant `switch(state)` in every method — but every new state (e.g. `OutOfStockState`) forces edits to *every* switch, violating Open/Closed. **State** encapsulates each status as a class implementing a common interface; the machine delegates to its current state object, and each state knows the *valid transitions*.

```text
+----------------+       +----------------+
| VendingMachine |------>| VendingState   |<interface>
+----------------+       +----------------+
| state          |          ^ ^ ^ ^  <|..
| insertCoin()   |    Idle HasMoney Dispensing SoldOut
| selectProduct()|
+----------------+
```

Each transition is now a new class, and the machine's methods just forward. Adding a state is additive. This is the textbook case where State beats enum+switch.

### Q3. Show the code skeleton for the vending machine State design.

```java
interface VendingState {
    void insertCoin(VendingMachine m, Coin c);
    void selectProduct(VendingMachine m, String code);
    void dispense(VendingMachine m);
}

class VendingMachine {
    private VendingState state = new IdleState();
    private final Inventory inventory;
    private Money balance = Money.ZERO;

    void setState(VendingState s) { this.state = s; }
    void addBalance(Coin c) { balance = balance.plus(c.value()); }
    // public API delegates to current state:
    public void insertCoin(Coin c) { state.insertCoin(this, c); }
    public void selectProduct(String code) { state.selectProduct(this, code); }
}

class IdleState implements VendingState {
    public void insertCoin(VendingMachine m, Coin c) {
        m.addBalance(c);
        m.setState(new HasMoneyState());     // transition
    }
    public void selectProduct(VendingMachine m, String code) {
        throw new IllegalStateException("Insert money first");
    }
    public void dispense(VendingMachine m) {
        throw new IllegalStateException("Nothing to dispense");
    }
}

class HasMoneyState implements VendingState {
    public void selectProduct(VendingMachine m, String code) {
        if (m.canAfford(code)) m.setState(new DispensingState(code));
        else throw new InsufficientFundsException();
    }
    // insertCoin adds more balance; dispense rejected
}
```

**Patterns beyond State**: **Strategy** for payment (`CoinPayment`, `CardPayment`), **Factory** for products. **Edge cases**: exact-change-only, out-of-stock (a `SoldOutState`), coin return on cancel (a `refund()` transition), concurrent selections (lock the machine during a transaction). `Money`/`Coin` are value objects, never doubles.

### Q4. Design an elevator system. What are the core classes and which patterns apply?

**Requirements**: a building with N floors and M elevator cars, up/down request buttons on each floor, a floor-selection panel inside each car, a controller that dispatches requests to cars.

**Core classes**: `ElevatorSystem` (controller — receives requests, dispatches), `Elevator` (one car: current floor, direction, request queue), `ElevatorState` (moving-up / moving-down / idle / maintenance — **State**), `Request` (source floor, destination, direction — a **Command**-ish value object), `SchedulingStrategy` (which car serves a request; how a car orders its stops — **Strategy**).

**Patterns**:
- **State** for the car's operational status — behavior differs when idle vs moving vs under maintenance.
- **Strategy** for *scheduling* — swap FCFS for the SCAN ("elevator algorithm," serve all requests in one direction then reverse) without touching the car.
- **Command** to model each button press as a queued request object.
- **Observer** (optional) so floor displays update as the car moves.

```text
+---------------+  1  *  +----------+  <>--- +--------------+
| ElevatorSystem|------->| Elevator |        | Request queue|
+---------------+        +----------+        +--------------+
       | uses                 | has-a
       v                      v
+-------------------+   +---------------+
| SchedulingStrategy|   | ElevatorState |  (Idle/MovingUp/MovingDown/Maintenance)
+-------------------+   +---------------+
```

The key design decision the interviewer probes: *don't* bury the scheduling algorithm inside `Elevator` — hoist it behind `SchedulingStrategy` so "now use the SCAN algorithm" is a new class, not a rewrite. That separation is the whole point of the elevator prompt.

### Q5. Show the elevator scheduling as a swappable Strategy and the car as State.

```java
enum Direction { UP, DOWN, IDLE }

interface SchedulingStrategy {
    // pick the next floor this car should stop at, given its pending requests
    Optional<Integer> nextStop(Elevator car, SortedSet<Integer> requests);
}

// SCAN / "elevator algorithm": keep going one direction, serve all stops, then reverse
class ScanStrategy implements SchedulingStrategy {
    public Optional<Integer> nextStop(Elevator car, SortedSet<Integer> requests) {
        if (car.direction() == Direction.UP)
            return requests.stream().filter(f -> f >= car.floor()).findFirst();
        return requests.stream().filter(f -> f <= car.floor())
                       .reduce((a, b) -> b);   // highest floor <= current
    }
}

class Elevator {
    private ElevatorState state = new IdleState();
    private final SchedulingStrategy strategy;   // injected — swappable
    private final SortedSet<Integer> requests = new TreeSet<>();
    private int floor;
    private Direction direction = Direction.IDLE;

    void addRequest(int f) { requests.add(f); state.onRequest(this); }
    void step() {
        strategy.nextStop(this, requests).ifPresentOrElse(
            this::moveToward,
            () -> setState(new IdleState()));
    }
}
```

`ElevatorState` (Idle/MovingUp/MovingDown/Maintenance) controls whether the car accepts requests and how it transitions on arrival. **Concurrency**: request queue is touched by button threads and the motion thread — guard with a lock or a concurrent structure. **Extension**: express elevators, weight limits, and "out of service" all become new strategies or states.

### Q6. Design an ATM. How do you avoid making the ATM class a god object?

The trap is one `ATM` class that validates the card, checks the PIN, verifies balance, dispenses cash, and prints the receipt. Instead, split into **entities** (`Account`, `Card`, `CashDispenser`, `Bank`), a **session controller** with **State** for the flow, and **Strategy/Command** for transactions.

**States of an ATM session**: `IdleState` (waiting for card) → `CardInsertedState` (waiting for PIN) → `AuthenticatedState` (choose transaction) → `TransactionState` (execute) → back to Idle. Each state permits only valid operations — the same State reasoning as the vending machine.

**Transactions as Command**: `WithdrawCommand`, `DepositCommand`, `BalanceInquiryCommand` all implement `Transaction { execute(Account) }`. This keeps the controller thin (it just runs the current command) and makes "add transfer" a new class.

```text
+-----+  1  1  +-------------+   uses   +------+ 1 * +---------+
| ATM |------->| ATMState    |          | Bank |---->| Account |
+-----+        +-------------+          +------+     +---------+
   | has-a         ^ (Idle/CardInserted/Authenticated/Transaction)
   v
+---------------+   +-------------+
| CashDispenser |   | Transaction |<interface>  (Withdraw/Deposit/BalanceInquiry -> Command)
+---------------+   +-------------+
```

**Patterns**: **State** (session flow), **Command** (transactions), **Strategy** could apply to cash-dispensing denomination algorithms, **Facade** — the `Bank` is a facade over account/auth subsystems. `Money` is a value object.

### Q7. Show the ATM transaction flow with State and Command.

```java
interface ATMState {
    void insertCard(ATM atm, Card card);
    void enterPin(ATM atm, String pin);
    void selectTransaction(ATM atm, Transaction txn);
}

interface Transaction { TransactionResult execute(Account account); }

class WithdrawCommand implements Transaction {
    private final Money amount;
    WithdrawCommand(Money amount) { this.amount = amount; }
    public TransactionResult execute(Account account) {
        if (account.balance().isLessThan(amount))         // guard clause
            return TransactionResult.declined("Insufficient funds");
        account.debit(amount);
        return TransactionResult.approved(amount);
    }
}

class AuthenticatedState implements ATMState {
    public void selectTransaction(ATM atm, Transaction txn) {
        TransactionResult result = txn.execute(atm.currentAccount());
        if (result.isApproved() && txn instanceof WithdrawCommand w)
            atm.dispenser().dispense(w.amount());
        atm.printReceipt(result);
        atm.setState(new IdleState());          // eject card, reset
    }
    public void insertCard(ATM atm, Card card) {
        throw new IllegalStateException("Session in progress");
    }
}
```

**Edge cases**: wrong PIN (retry limit → confiscate card), insufficient balance (guard), dispenser out of cash, network failure to `Bank` (transaction must be atomic — don't debit if dispense fails). **Concurrency**: the `Account` may be touched by other channels — the debit must be atomic/locked at the account level. Note the *debit-then-dispense ordering* and its compensation is the interesting correctness discussion the interviewer wants.

### Q8. Design a library management system. What entities, relationships, and lifecycle?

**Requirements**: members borrow physical book copies, limited loan count per member, due dates and fines for overdue returns, search catalog, reserve books.

**Entities**: distinguish `Book` (the *title* — ISBN, author, one per work) from `BookCopy` (a *physical item* — barcode, status). This one-to-many is the classic modeling insight interviewers look for. Plus `Member`, `Loan` (links a member to a copy with due date), `Reservation`, `Catalog` (searchable registry), `LibraryManager` (thin controller / facade).

**Relationships**:

```text
+------+ 1  * +----------+       +--------+ 1 * +------+
| Book |----->| BookCopy |       | Member |---->| Loan |
+------+      +----------+       +--------+     +------+
                   ^ 1                              | *
                   |            (a Loan links one Member to one BookCopy)
                   +------------------------------- 1
+---------+ contains * +----------+
| Catalog |----------->| Book     |
+---------+            +----------+
```

**Lifecycle** of a `BookCopy`: `AVAILABLE → BORROWED → (RETURNED → AVAILABLE | OVERDUE)` / `RESERVED`. This status field is a candidate for **State** if the transitions carry behavior, or a simple enum if not — I'd start with an enum and note State as the upgrade if reservation/hold rules grow.

**Patterns**: **Strategy** for fine calculation (flat per day vs escalating), **Observer** to notify a member when a reserved book becomes available, **Factory** minimal, **Facade** (`LibraryManager`). `Loan` and `Fine` involve `Money` value objects and dates.

### Q9. Show the borrow/return core code for the library, including fines.

```java
class Loan {
    private final BookCopy copy;
    private final Member member;
    private final LocalDate dueDate;
    Loan(BookCopy copy, Member member, LocalDate due) { ... }
    boolean isOverdue() { return LocalDate.now().isAfter(dueDate); }
}

interface FineStrategy { Money fineFor(long daysLate); }
class FlatFineStrategy implements FineStrategy {
    private final Money perDay;
    public Money fineFor(long daysLate) { return perDay.times(daysLate); }
}

class LibraryManager {
    private final FineStrategy fineStrategy;

    Loan borrow(Member member, BookCopy copy) {
        if (member.activeLoans() >= member.loanLimit())        // guard
            throw new LoanLimitExceededException();
        if (copy.status() != Status.AVAILABLE)                  // guard
            throw new CopyUnavailableException();
        copy.markBorrowed();
        Loan loan = new Loan(copy, member, LocalDate.now().plusDays(14));
        member.addLoan(loan);
        return loan;
    }

    Money returnCopy(Loan loan) {
        loan.copy().markAvailable();
        loan.member().removeLoan(loan);
        long late = Math.max(0, DAYS.between(loan.dueDate(), LocalDate.now()));
        return late > 0 ? fineStrategy.fineFor(late) : Money.ZERO;
    }
}
```

**Extensions**: reservations (Observer notifies the next member when a copy frees up), e-books (a `Book` with unlimited copies — subclass or a `copyCount` policy), tiered fines (new `FineStrategy`). The `FineStrategy` seam is what makes "change the fine policy" a one-class change.

### Q10. Across these five designs, where does Strategy keep showing up and why?

Strategy appears wherever an *algorithm* varies independently of the object that uses it. Tabulating it:

| Design | Strategy for | Alternatives that would swap |
|---|---|---|
| Parking lot | Pricing, payment | flat / hourly / surge; cash / card |
| Vending machine | Payment | coin / card / mobile |
| Elevator | Scheduling | FCFS / SCAN / LOOK |
| ATM | Cash denomination, transaction routing | fewest-notes / prefer-small |
| Library | Fine calculation | flat / escalating / grace-period |

The reason it recurs: in each domain there's a *policy* that the business will want to change without touching the core flow. Strategy isolates that policy behind an interface so the change is "new implementation, zero edits" (Open/Closed). Recognizing "this is a *policy that varies* → Strategy" is the single most reused move across LLD case studies. Contrast with **State**, which also swaps behavior at runtime but is driven by the object's *own lifecycle status* rather than an externally-chosen policy — the vending machine uses *both* (State for status, Strategy for payment).

### Q11. When is a Singleton actually justified in these designs, and when is it a trap?

Singleton is justified only for a *genuinely unique* resource where a second instance would be meaningless or harmful — and even then I prefer to create one instance and *inject* it rather than use the global-access Singleton pattern. Candidates:

- **Reasonable**: a hardware-backed `CashDispenser` (there's physically one), a shared `Configuration`, a `Logger`. Even these are better as one injected instance.
- **Trap**: making `ParkingLot`, `ATM`, or `LibraryManager` a Singleton "because there's one." That bakes a global into every caller, hides the dependency, and makes the class impossible to unit-test in isolation or run two lots in one test suite.

```java
// Thread-safe singleton IF you truly need one (Bill Pugh / holder idiom):
class Config {
    private Config() {}
    private static class Holder { static final Config INSTANCE = new Config(); }
    static Config get() { return Holder.INSTANCE; }   // lazy, no locking
}
```

The senior move is to say: "I *could* Singleton the lot, but I'll inject a single `ParkingLot` instead — same uniqueness at runtime, but testable and no hidden global." Naming Singleton's downsides (global state, testability, hidden coupling, concurrency pitfalls of naive lazy init) scores higher than reflexively using it.

### Q12. How does the Factory pattern help in these case studies, and which flavor?

Factory centralizes *object creation* so the rest of the code doesn't hard-code concrete classes. Two flavors show up:

- **Simple Factory (idiom)** — a static method that maps input to a concrete type. Enough for "given a vehicle-size code, make the right `Vehicle`," or "given a product code, make the right `Product`."
- **Factory Method** — a creation method subclasses override, used when the creator hierarchy itself varies.

For these designs, Simple Factory is almost always sufficient:

```java
class VehicleFactory {
    static Vehicle create(VehicleSize size) {
        return switch (size) {
            case MOTORCYCLE -> new Motorcycle();
            case CAR        -> new Car();
            case TRUCK      -> new Truck();
        };
    }
}
```

I *don't* reach for **Abstract Factory** (families of related products) in a parking lot — there's no family of related products to create, so it'd be over-engineering. I'd only mention Abstract Factory if the prompt introduced, say, themed UI toolkits or cross-platform widget families. The distinction — Factory Method (one product, subclass decides) vs Abstract Factory (families of products) — is a common follow-up, and correctly *declining* Abstract Factory here is a positive signal.

### Q13. Compare State and Strategy using the elevator and vending machine as examples.

They have near-identical UML (an object delegating to an interface with interchangeable implementations) but differ in *intent and who drives the switch*:

| | Strategy | State |
|---|---|---|
| Intent | Swap an *algorithm/policy* | Change behavior with *lifecycle status* |
| Who changes it | The client picks it (usually once) | The object transitions *itself* |
| Do impls know each other? | No — independent | Yes — each state knows its successors |
| Elevator use | `SchedulingStrategy` (FCFS vs SCAN) | `ElevatorState` (idle/moving/maintenance) |
| Vending use | `PaymentStrategy` (coin/card) | `VendingState` (idle/hasMoney/dispensing) |

The tell: if implementations *transition to each other* (`IdleState` sets the machine to `HasMoneyState`), it's **State**. If the client injects one and it never changes itself (you pass `ScanStrategy` at construction), it's **Strategy**. The elevator is the perfect teaching example because it uses *both simultaneously* — the car's operational status is State (it moves itself between idle and moving), while the scheduling policy is Strategy (chosen externally, doesn't transition). Saying that out loud demonstrates you understand the distinction beyond "they look the same."

### Q14. What edge cases distinguish a senior answer in these designs?

Juniors design the happy path; seniors enumerate the failure modes and show the design handles them via guard clauses and clear domain exceptions:

- **Parking lot**: lot full, lost/invalid ticket, oversized vehicle, double-park the same car, exit without a valid ticket.
- **Vending machine**: exact-change-only, out-of-stock mid-transaction, coin jam / refund on cancel, power loss mid-dispense.
- **Elevator**: all cars busy, request for the current floor, out-of-service car, weight/capacity limit, simultaneous up+down at one floor.
- **ATM**: wrong PIN retry limit, insufficient funds, dispenser empty, network failure *after* debit (compensation), card left in machine.
- **Library**: loan-limit exceeded, borrowing an unavailable copy, returning a lost book, overdue fine caps, reserving an already-available copy.

The pattern across all: check preconditions with **guard clauses** at the top of the method and fail with a *specific domain exception* (`LotFullException`, `InsufficientFundsException`) rather than returning null or a bare boolean. And for the money/atomicity ones (ATM debit-then-dispense), the senior discussion is *ordering and compensation* — never leave the system in a half-committed state.

### Q15. If asked to make one of these thread-safe, how do you approach it?

I locate the *shared mutable state* and the *check-then-act* races, then guard at the finest granularity that stays correct.

- **Parking lot** — the free-spot set is shared across gate threads; two gates can both grab the last spot. Guard the find-and-occupy as one atomic critical section; lock *per floor* rather than globally so different floors don't contend. Alternatively an `AtomicInteger` free-count plus a compare-and-set on each spot's status.
- **Vending machine** — one machine, concurrent button presses; serialize a transaction (insert → select → dispense) so balance and inventory stay consistent. A per-machine lock is fine; it's inherently low-contention.
- **Elevator** — the request queue is written by button threads and read by the motion thread; use a concurrent/locked queue and make state transitions atomic.
- **ATM** — the `Account` is shared across channels; the debit must be atomic at the account level (row lock / synchronized / optimistic version), and debit-then-dispense must be all-or-nothing.

```java
// Fine-grained: lock the floor, not the whole lot
Optional<ParkingSpot> park(Vehicle v) {
    ParkingFloor floor = pickFloor(v.size());
    synchronized (floor) {                         // per-floor lock
        return floor.findFree(v.size()).map(s -> { s.occupy(v); return s; });
    }
}
```

I also lean on **immutability** for the value objects (`Ticket`, `Money`, `Request`) so they're safe to share with no locking at all — that reduces the surface that *needs* guarding. This links to the Concurrency primer for the deeper mechanics.

### Q16. Take the parking lot and show how it absorbs three common follow-up extensions.

The whole point of placing pattern seams is that follow-ups become additive. Three typical asks:

**"Add electric-vehicle charging spots."** New spot subtype, no edits to `ParkingLot`:

```java
class ChargingSpot extends ParkingSpot {
    private final Charger charger;
    @Override void occupy(Vehicle v) { super.occupy(v); if (v.isElectric()) charger.start(); }
}
```

**"Add surge pricing at peak hours."** New `PricingStrategy`, injected — `ParkingLot` untouched (Open/Closed):

```java
class SurgePricing implements PricingStrategy {
    public Money price(Duration d, VehicleSize s) {
        Money base = hourly.price(d, s);
        return isPeakNow() ? base.times(1.5) : base;
    }
}
```

**"Support monthly passes."** Another `PricingStrategy` returning `Money.ZERO` for pass-holders, plus a `Membership` entity — still additive.

The narration that scores: "Because I put the varying dimensions — spot type behind a class hierarchy, pricing behind Strategy — each of these is a *new class with zero edits to existing code*. If I'd hard-coded pricing as a `double` and spot type as an enum with a switch, every one of these would mean editing `ParkingLot`. That's the Open/Closed payoff for the seams I chose in step five." This is the moment the interview process pays dividends.

## LLD Case Studies II & Playbooks

### Summary

**What this topic covers**

The second batch of worked object designs plus a strategy wrap-up. This topic has 17 questions covering **tic-tac-toe / chess (board games)**, an **in-memory LRU cache**, a **rate limiter**, a **logging framework**, a **notification / pub-sub service**, **Splitwise (expense sharing)**, and a **file system / in-memory key-value store** — each run through requirements → core objects → patterns → code skeleton. It then closes with an **interview-strategy playbook**: how to reason out loud, structure trade-off discussions, handle follow-ups, and recover when you're stuck. Where *Case Studies I* leaned on State and Strategy for stateful machines, this set broadens the pattern vocabulary: **Chain of Responsibility** (logger), **Observer** (pub/sub), **Composite** (file system), **Strategy** (rate-limiter algorithm, Splitwise split types), and careful *data-structure design* (LRU cache is a `HashMap` + doubly-linked list, not a GoF pattern at all).

**Mental model**

Two mental shifts distinguish this set. First, **not every LLD prompt is a GoF-pattern hunt** — the LRU cache and the KV store are *data-structure* designs where the skill is choosing the right structures (hash map + intrusive doubly-linked list for O(1) LRU) and getting the pointer manipulation right, not naming a pattern. Recognizing "this one is about data structures, not patterns" is itself senior judgment. Second, several of these are fundamentally about **decoupling producers from consumers**: pub/sub, the logger, and notifications all separate "something happened" from "who reacts," which is the **Observer** family. The reusable move is: model the *event* as an object, keep a registry of subscribers/handlers, and iterate. For the board games, the recurring insight is separating *rules* (what moves are legal — Strategy per piece) from *state* (whose turn, board contents, game status — often State), so chess and tic-tac-toe share a skeleton. The playbook then generalizes: whatever the nouns, the process and the trade-off narration are the transferable skill.

**Key terms**

- **LRU (least-recently-used)** — eviction policy keeping the most recently accessed entries; O(1) with a hash map + doubly-linked list.
- **Intrusive doubly-linked list** — nodes carry prev/next pointers so any node can be unlinked in O(1) without a search.
- **Token bucket / sliding window** — rate-limiting algorithms; swappable behind a Strategy.
- **Chain of Responsibility** — a pipeline of handlers each deciding to handle or pass on (log-level filters, appenders).
- **Observer / pub-sub** — subjects notify registered observers of events; the basis of notification and event systems.
- **Composite** — treat individual objects and compositions uniformly (files and directories via one `Node` interface).
- **Split strategy** — how a Splitwise expense divides (equal / exact / percentage) — a Strategy.
- **Value object** — immutable descriptors (`Move`, `Position`, `Money`, `Expense`).
- **Handler / appender** — a logger's output sink (console, file, network).
- **Balance / ledger** — Splitwise's net owed-between-users state, updated per expense.
- **Eviction policy** — the pluggable rule a cache uses to make room (LRU / LFU / FIFO) — another Strategy.

**Why interviewers ask this**

This set stresses *breadth of modeling judgment*. The LRU cache is a favorite because it filters candidates who can only name patterns from those who can actually design a data structure to a complexity target (O(1) get/put) and reason about invariants. The logger and pub/sub test whether you recognize the Observer/Chain-of-Responsibility shapes and can keep producers decoupled from consumers. Splitwise tests domain modeling with money (value objects, no floating-point, balancing a ledger) and Strategy for split types. The board games test separating rules from state and extensibility (tic-tac-toe → chess with the same skeleton). Across all of them, senior signal is *choosing the right tool* — knowing when it's a data-structure problem vs a pattern problem — and the closing playbook questions directly probe interview *behavior*: can you narrate trade-offs, handle a curveball follow-up, and recover from a wrong turn without unraveling.

**Common confusions**

- "LRU cache needs a design pattern" — it needs a hash map + doubly-linked list; the *eviction policy* can be Strategy, but the core is data-structure design.
- "Observer and pub/sub are different beasts" — pub/sub is Observer with a broker/topic in between decoupling subject from observer; same core intent.
- "Chain of Responsibility = a list of if/else" — the point is each handler independently decides to handle or forward, and the chain is reconfigurable at runtime.
- "Composite is just a tree" — it's specifically about a *uniform interface* over leaf and container so clients don't branch on type.
- "Money can be a double in Splitwise" — never; rounding errors break the ledger. Use integer minor units in a `Money` value object.
- "Chess needs one giant `Board.isValidMove` switch" — push move legality onto each `Piece` (polymorphism / Strategy) so adding a piece doesn't edit a mega-method.

**What follows from this topic**

This closes the OOD primer's case-study arc. The patterns exercised here — Observer, Chain of Responsibility, Composite, Strategy — connect back to the dedicated GoF-pattern topics, and the data-structure designs (LRU, KV store) connect to the language and DSA primers. The closing **playbook** is the meta-layer over *The LLD Interview Process*: process gets you a design, the playbook gets you through the *conversation* around it. Together the three LLD topics give you a repeatable loop plus a bank of worked examples to pattern-match against any "design an X" prompt.

### Q1. Design tic-tac-toe. What classes, and how do you keep it extensible to other board games?

**Requirements**: two players, 3×3 board, alternate turns, detect win/draw, reject invalid moves.

**Core classes**: `Game` (controller: turn order, game status), `Board` (grid of cells, place mark, check state), `Cell` (empty or a `Symbol`), `Player` (name, symbol), `Move` (row, col, player — value object), `WinChecker` (detect terminal state — a **Strategy** so 3×3 and connect-4 differ only here).

**Patterns**: **State** for game status (`InProgress` / `Won` / `Draw`), **Strategy** for the win-detection rule and for player type (human vs AI), **Factory** minimal.

```java
enum Symbol { X, O, EMPTY }

class Game {
    private final Board board;
    private final List<Player> players;
    private int current = 0;
    private GameState state = GameState.IN_PROGRESS;

    void play(int row, int col) {
        if (state != GameState.IN_PROGRESS) throw new GameOverException();  // guard
        Player p = players.get(current);
        board.place(row, col, p.symbol());        // throws if occupied
        if (board.hasWon(p.symbol()))  state = GameState.WON;
        else if (board.isFull())       state = GameState.DRAW;
        else current = (current + 1) % players.size();   // alternate turn
    }
}
```

**Extensibility to chess**: the skeleton — `Game` drives turns, `Board` holds state, `Move` is validated — is identical. The difference is *move legality*: tic-tac-toe's rule is "cell empty," chess's is per-piece. Keep that behind a polymorphic `isValid(Move)` and the same `Game`/`Board` scaffold scales up. That separation of *scaffold* from *rules* is the answer the interviewer wants.

### Q2. Now design chess. How do you model pieces and move validation without a god method?

The trap is one `Board.isValidMove(from, to)` with a giant `switch(pieceType)`. Instead, push move legality onto each `Piece` subclass via polymorphism — adding a piece is a new class, not an edit to a mega-method (Open/Closed).

**Core classes**: `Board` (8×8 of `Cell`), `Piece` (abstract: `canMove(from, to, board)`), concrete `King`/`Queen`/`Rook`/`Bishop`/`Knight`/`Pawn`, `Move` (from, to, captured — value object), `Player`, `Game` (turn order, check/checkmate, status via **State**).

```text
+-------+ contains * +------+   holds   +-------+
| Board |----------->| Cell | o-------> | Piece |
+-------+            +------+           +-------+
                                            ^ <|--
                    King  Queen  Rook  Bishop  Knight  Pawn
                    (each overrides canMove -> polymorphic rule)
```

```java
abstract class Piece {
    protected final Color color;
    abstract boolean canMove(Cell from, Cell to, Board board);  // per-piece rule
}
class Rook extends Piece {
    boolean canMove(Cell from, Cell to, Board board) {
        return (from.row() == to.row() || from.col() == to.col())
               && board.isPathClear(from, to);         // straight line, unobstructed
    }
}
class Bishop extends Piece {
    boolean canMove(Cell from, Cell to, Board board) {
        return Math.abs(from.row()-to.row()) == Math.abs(from.col()-to.col())
               && board.isPathClear(from, to);         // diagonal
    }
}
```

**Patterns**: polymorphic move rules (Strategy-via-inheritance), **State** for game status, **Memento** if you want undo (snapshot board), **Command** to model moves for undo/replay. **Edge cases**: check, checkmate, stalemate, castling, en passant, promotion — each is special-cased in the relevant `Piece`/`Game` logic, and you'd flag them as extensions rather than implement all in 45 minutes.

### Q3. Design an in-memory LRU cache with O(1) get and put. Why is this not really a GoF-pattern problem?

Because the core is a *data-structure* choice, not a pattern: a **hash map** for O(1) lookup plus an **intrusive doubly-linked list** for O(1) recency ordering. The map points key → node; the list orders nodes most-recently-used at the head. On access you unlink the node and move it to the head; on insert past capacity you evict the tail.

```text
map: key -> Node                  DLL (MRU .......... LRU)
                                  head <-> A <-> B <-> C <-> tail
get(B): unlink B, move to head -> head <-> B <-> A <-> C <-> tail
put when full: evict tail (C), remove from map
```

Recognizing "this is data structures, not patterns" is the senior signal — a candidate who tries to force a Decorator or Proxy here is pattern-matching for its own sake. The *one* place a pattern legitimately fits is making the **eviction policy** pluggable (LRU vs LFU vs FIFO) behind a **Strategy** — but the interviewer usually wants the O(1) LRU mechanics first, policy-generalization second.

### Q4. Show the LRU cache code with the hash map + doubly-linked list.

```java
class LRUCache<K, V> {
    private final int capacity;
    private final Map<K, Node<K, V>> map = new HashMap<>();
    private final Node<K, V> head, tail;   // sentinel dummy nodes

    LRUCache(int capacity) {
        this.capacity = capacity;
        head = new Node<>(null, null);
        tail = new Node<>(null, null);
        head.next = tail; tail.prev = head;    // empty list between sentinels
    }

    V get(K key) {
        Node<K, V> node = map.get(key);
        if (node == null) return null;
        moveToHead(node);                      // mark most-recently-used
        return node.value;
    }

    void put(K key, V value) {
        Node<K, V> node = map.get(key);
        if (node != null) { node.value = value; moveToHead(node); return; }
        if (map.size() == capacity) evictTail();       // make room
        Node<K, V> fresh = new Node<>(key, value);
        map.put(key, fresh);
        addToHead(fresh);
    }

    private void moveToHead(Node<K, V> n) { unlink(n); addToHead(n); }
    private void unlink(Node<K, V> n) { n.prev.next = n.next; n.next.prev = n.prev; }
    private void addToHead(Node<K, V> n) {
        n.prev = head; n.next = head.next;
        head.next.prev = n; head.next = n;
    }
    private void evictTail() {
        Node<K, V> lru = tail.prev;
        unlink(lru); map.remove(lru.key);
    }
    static class Node<K, V> { K key; V value; Node<K, V> prev, next; /* ctor */ }
}
```

The **sentinel** head/tail nodes eliminate null-checks at the boundaries — a clean-code touch worth calling out. **Concurrency**: this is not thread-safe; for a concurrent cache I'd guard with a lock (simple) or note that Java's `LinkedHashMap` with `accessOrder=true` gives LRU semantics out of the box, and for production I'd reach for Caffeine. **Extension**: swap `evictTail` for an injected `EvictionPolicy` Strategy to support LFU/FIFO.

### Q5. Design a rate limiter as a set of classes. Which algorithm and how do you make it swappable?

**Requirements**: cap requests per client to N per time window; support multiple algorithms; be thread-safe.

The algorithm is the axis of variation, so it goes behind a **Strategy** — `RateLimiter { boolean allow(String clientId); }` with implementations for **token bucket**, **fixed window**, and **sliding window log**.

```java
interface RateLimiter { boolean allow(String clientId); }

class TokenBucketLimiter implements RateLimiter {
    private final int capacity;
    private final double refillPerSec;
    private final Map<String, Bucket> buckets = new ConcurrentHashMap<>();

    public boolean allow(String clientId) {
        Bucket b = buckets.computeIfAbsent(clientId, k -> new Bucket(capacity));
        synchronized (b) {
            b.refill(refillPerSec);            // add tokens for elapsed time
            if (b.tokens >= 1) { b.tokens -= 1; return true; }
            return false;                       // throttled
        }
    }
}
```

**Token bucket** is my default: it allows short bursts (up to capacity) while enforcing a long-run rate, and it's O(1) with just a token count + last-refill timestamp per client — cheaper than a sliding-window *log* which stores every timestamp.

**Patterns**: **Strategy** (algorithm), optionally **Decorator** to layer a rate-limit check onto an existing request handler. **Concurrency**: per-client bucket lock or atomics; the `ConcurrentHashMap` handles the registry. **Trade-off to narrate**: fixed window is simplest but allows 2× bursts at window edges; sliding window is smoother but costs more memory; token bucket balances both — that comparison is exactly the follow-up they want.

### Q6. Design a logging framework. Which patterns and why?

Two patterns do the heavy lifting: **Chain of Responsibility** for *level filtering* and **Strategy** (or the appender idiom) for *output destinations*.

**Chain of Responsibility** — each logger in the chain handles messages at/above its threshold and passes others along. This lets you compose "debug logger → info logger → error logger" without an if/else ladder, and reconfigure at runtime.

```java
abstract class Logger {
    protected final Level level;
    protected Logger next;
    Logger setNext(Logger n) { this.next = n; return n; }
    void log(Level msgLevel, String message) {
        if (msgLevel.ordinal() >= level.ordinal()) write(message);   // handle
        if (next != null) next.log(msgLevel, message);               // and/or pass on
    }
    abstract void write(String message);
}
class ConsoleLogger extends Logger { void write(String m) { System.out.println(m); } }
class FileLogger extends Logger { void write(String m) { /* append to file */ } }
```

**Appenders as Strategy** — the *destination* (console / file / network / database) varies independently; model each as an `Appender` implementation the logger writes to. A `Logger` can hold a list of appenders.

**Other patterns**: **Singleton** is the *traditional* choice for the root logger — but I'd note it's better as one injected instance for testability. **Observer** is an alternative framing (appenders subscribe to log events). **Concurrency**: file/console writes need synchronization or an async queue so log calls don't block. **Extension**: new levels (enum entry), new destinations (new appender), formatting (a `Formatter` Strategy).

### Q7. Design a notification / pub-sub service. How is this Observer, and how does pub/sub differ?

At its core this is the **Observer** pattern: a *subject* holds a list of *observers* and notifies them when an event occurs, decoupling "something happened" from "who reacts."

```java
interface Subscriber { void onEvent(Event e); }

class Topic {                                   // the subject
    private final List<Subscriber> subscribers = new CopyOnWriteArrayList<>();
    void subscribe(Subscriber s)   { subscribers.add(s); }
    void unsubscribe(Subscriber s) { subscribers.remove(s); }
    void publish(Event e) { for (Subscriber s : subscribers) s.onEvent(e); }  // notify all
}
```

**How pub/sub differs from plain Observer**: pub/sub inserts a **broker/topic** between publisher and subscriber, so the publisher doesn't hold references to subscribers at all — it publishes to a *named topic*, and the broker fans out. That's looser coupling than classic Observer (where the subject directly knows its observers) and enables many-publishers-to-many-subscribers, message durability, and async delivery. Same *intent* (decouple event source from reaction), different *coupling*.

**For a notification service specifically**: layer a **Strategy** for the delivery *channel* (email / SMS / push), so a `NotificationService` publishes an event and each subscriber routes it through its channel strategy — combining Observer (who gets notified) with Strategy (how). **Concurrency**: `CopyOnWriteArrayList` or a concurrent registry so subscribe/unsubscribe during publish is safe; a real system uses an async queue. **Edge cases**: slow/failing subscriber (don't let it block others — isolate/async), delivery retries, unsubscribe during notify.

### Q8. Design Splitwise (expense sharing). How do you model expenses, splits, and balances?

**Requirements**: users in groups, add an expense paid by one and split among several, support equal / exact / percentage splits, show net balances (who owes whom).

**Core classes**: `User`, `Group`, `Expense` (amount, payer, list of `Split`), `Split` (a user + their share — value object), `SplitStrategy` (equal / exact / percentage — **Strategy**), `BalanceSheet` (net owed-between-users ledger).

The split *type* is the variation axis → **Strategy**:

```java
interface SplitStrategy { List<Split> split(Money total, List<User> among, Object... params); }

class EqualSplit implements SplitStrategy {
    public List<Split> split(Money total, List<User> among, Object... p) {
        Money share = total.dividedBy(among.size());     // handle remainder cents!
        return among.stream().map(u -> new Split(u, share)).toList();
    }
}
class PercentageSplit implements SplitStrategy { /* shares from percentages */ }
```

**Balance update** — the ledger tracks a signed net between each pair; adding an expense credits the payer and debits each participant:

```java
class BalanceSheet {
    private final Map<Pair<User,User>, Money> net = new HashMap<>();
    void applyExpense(Expense e) {
        for (Split s : e.splits()) {
            if (s.user().equals(e.payer())) continue;
            adjust(s.user(), e.payer(), s.amount());   // s.user owes payer s.amount
        }
    }
}
```

**Critical correctness point — never use `double` for money.** Use a `Money` value object backed by integer minor units (cents), and handle the remainder when an amount doesn't divide evenly (assign the leftover cent to one participant). Interviewers specifically probe this. **Patterns**: **Strategy** (split type), value objects (`Money`, `Split`). **Extensions**: simplify-debts algorithm (minimize transactions), multi-currency, settlements.

### Q9. Design an in-memory key-value store / file system. Which pattern for the file system?

These are two related data-structure/modeling prompts.

**In-memory KV store**: at its simplest a `ConcurrentHashMap<String, Value>` behind a `KeyValueStore { get/put/delete }` interface. The interesting extensions are the follow-ups: **TTL/expiry** (store `(value, expiryTime)`, lazily evict on read + a background sweeper), **LRU eviction** (reuse the map + doubly-linked-list design), **transactions** (a staging map committed atomically), **persistence** (a write-ahead log behind a `Persistence` Strategy). Keep the public interface tiny and push each feature behind a seam.

**File system**: this is the textbook **Composite** pattern — a `File` (leaf) and a `Directory` (container) share one `FileSystemNode` interface, so clients treat them uniformly (compute size, list, delete) without branching on type.

```java
interface FileSystemNode { String name(); long size(); }

class File implements FileSystemNode {
    private final String name; private final byte[] content;
    public long size() { return content.length; }
}
class Directory implements FileSystemNode {
    private final String name;
    private final List<FileSystemNode> children = new ArrayList<>();
    public long size() {                                   // recurse uniformly
        return children.stream().mapToLong(FileSystemNode::size).sum();
    }
    void add(FileSystemNode node) { children.add(node); }
}
```

The Composite payoff: `directory.size()` recurses through arbitrarily nested files and directories with no type-checking. **Extensions**: symlinks (a node pointing to another), permissions (decorate nodes), path resolution (walk the tree). **Iterator** pattern fits for traversal. This is the cleanest showcase of Composite in the whole primer.

### Q10. Across this second set, map each design to its defining pattern or structure.

A consolidated cheat sheet — the recognition skill the interview rewards:

| Design | Defining tool | Why |
|---|---|---|
| Tic-tac-toe / chess | Polymorphism (Strategy-via-inheritance) + State | Move rules per piece; game status lifecycle |
| LRU cache | Data structure: HashMap + doubly-linked list | O(1) get/put; not a GoF pattern |
| Rate limiter | Strategy | Swappable algorithm (token bucket / windows) |
| Logging framework | Chain of Responsibility + Strategy | Level filtering chain; pluggable appenders |
| Pub/sub / notifications | Observer | Decouple event source from reactions |
| Splitwise | Strategy + Money value object | Swappable split types; correct money math |
| File system | Composite | Uniform interface over files and directories |
| KV store | Data structure + Strategy seams | Map core; TTL/LRU/persistence behind seams |

The meta-lesson: LLD prompts fall into a few buckets — *stateful machine* (State), *swappable policy* (Strategy), *event fan-out* (Observer), *uniform tree* (Composite), *pipeline* (Chain of Responsibility), and *pure data structure* (LRU, KV). Classifying the prompt into a bucket in the first two minutes is what lets you design fast. Forcing a pattern where a data structure belongs (or vice versa) is the classic misfire.

### Q11. What's the interview-strategy playbook — how do you reason out loud effectively?

Narrate a *decision*, not a stream of consciousness. The shape of a good spoken trade-off is: **"I'm choosing X over Y because Z, and I'm accepting the cost of W."** Concretely:

- **Name the decision point**: "Move legality can live in `Board` or on each `Piece`."
- **State the options and the axis**: "In `Board` it's one method but a growing switch; on each `Piece` it's polymorphic — adding a piece is a new class."
- **Pick and justify with a principle**: "I'll put it on `Piece` — Open/Closed, and it keeps `Board` cohesive."
- **Acknowledge the cost**: "The trade-off is logic spread across six classes instead of one file."

Do this at every fork: enum vs class hierarchy, State vs Strategy, Singleton vs injection, inheritance vs composition. The interviewer is scoring whether you *see* the fork and *reason* about it, not whether you pick their favorite. Silence is the enemy — a correct design produced without narration is indistinguishable from a lucky guess. Equally, don't narrate trivia ("now I'll name this variable `count`"); reserve the talk for choices that have a defensible alternative.

### Q12. How do you handle trade-offs and follow-up questions gracefully?

Follow-ups are the *point* of the round — they test whether your design *bends*. Handle them in three beats:

1. **Locate the change on your existing seams.** "Add a new payment type" → "that's a new `PaymentStrategy` implementation, no edits to the controller." If you placed the seams well in the process, most follow-ups are additive and you say so immediately.
2. **If it doesn't fit a seam, say so honestly and propose the refactor.** "My current design hard-coded that as an enum; to support this cleanly I'd extract a Strategy here — here's the one-class change." Admitting a design didn't anticipate something *and* showing the fix beats pretending it's covered.
3. **Discuss the trade-off explicitly.** For "make it distributed / thread-safe / persistent," name the options and their costs rather than jumping to one: "For thread-safety I can coarse-lock the whole lot (simple, low throughput) or lock per floor (more complex, scales) — I'd start coarse and refine if contention shows."

The anti-pattern is treating a follow-up as an attack and getting defensive, or silently rewriting half the design. Treat each as "the requirements evolved, watch my design absorb it" — which is exactly what a good OO design is *for*.

### Q13. What do you do when you get stuck or realize you took a wrong turn?

Getting stuck is normal and recoverable; how you recover is itself a signal. My recovery moves, in order:

- **Say it out loud and re-anchor.** "I think I over-complicated this — let me step back to the requirements." Interviewers respect course-correction far more than silently digging deeper into a hole.
- **Return to the core flow.** If lost in edge cases, drop back to the one primary scenario (park → pay → exit) and confirm it's clean before re-adding complexity.
- **Simplify aggressively.** If a design is tangled, collapse it — remove a premature abstraction, inline a needless layer. "This Factory isn't earning its place; I'll drop it and construct directly." Removing complexity under pressure is a senior move.
- **Ask a clarifying question.** Being stuck often means an ambiguous requirement — "Am I over-thinking this, or do we actually need multiple lots?" A good interviewer will nudge you.
- **Use the pattern buckets.** If you can't see the design, classify the prompt: stateful machine → State, swappable policy → Strategy, event fan-out → Observer. The bucket suggests the skeleton.

The failure mode is freezing silently or stubbornly defending a wrong path. Narrated recovery ("that was the wrong abstraction, here's the simpler one") often scores *higher* than a design that happened to go right on the first try, because it demonstrates real engineering judgment.

### Q14. How do you decide between an enum and a class hierarchy for a fixed set of types?

A recurring micro-decision (vehicle sizes, coin denominations, piece colors, log levels). The rule: **enum when the set is small, fixed, and the variation is data; class hierarchy when each type carries distinct behavior.**

| Use enum when | Use class hierarchy when |
|---|---|
| Fixed, known-at-compile-time set | Types added by extension later |
| Variation is a value (size, price) | Variation is behavior (per-type logic) |
| No per-type methods needed | Each type overrides methods |
| e.g. `VehicleSize`, `Level`, `Suit` | e.g. `Vehicle`, `Piece`, `Notification` |

Enums *can* carry behavior (enum with abstract methods per constant), which handles the middle ground — but once behavior gets rich or types need to be added without recompiling the enum, a class hierarchy is the right call (Open/Closed — new type = new class, no edit to a central enum). In an interview I say: "Vehicle *size* is a fixed enum, but vehicle *behavior* (a truck occupies multiple spots) is a `Vehicle` subclass — the size is data, the behavior is polymorphism." Making that split explicit shows you're not reflexively reaching for one tool.

### Q15. How would you turn one of these single-threaded designs into a thread-safe one under questioning?

Same discipline as Case Studies I: find the shared mutable state, identify the check-then-act race, guard at the finest safe granularity, and prefer immutability where possible.

- **LRU cache** — every `get` mutates the linked list; concurrent gets corrupt pointers. Simplest: a single lock around get/put. Better throughput: a `ConcurrentHashMap` plus a lock only on the recency-list operations, or accept approximate LRU (like Caffeine) to avoid locking on reads.
- **Rate limiter** — per-client bucket is shared; use a per-bucket lock or atomic token count, with a `ConcurrentHashMap` registry (already shown).
- **Pub/sub** — the subscriber list is mutated during iteration; `CopyOnWriteArrayList` or snapshot-then-iterate avoids `ConcurrentModificationException`, and slow subscribers should be dispatched async so one doesn't block the fan-out.
- **KV store** — `ConcurrentHashMap` handles most of it; TTL sweeping and transactions need explicit coordination.

```java
// Trade-off narration for the LRU cache:
synchronized V get(K key) { ... }     // correct, but serializes all reads
// vs. striped locking / concurrent map for throughput — more complex, and
// strict LRU ordering under concurrency is expensive, so production caches
// (Caffeine) use approximate LRU. I'd state that trade-off explicitly.
```

The senior framing is always the *spectrum*: coarse lock (simple, correct, low throughput) → fine-grained/striped (complex, scalable) → lock-free/approximate (fastest, weaker guarantees). Name where on the spectrum you'd start and why, and note immutable value objects (`Event`, `Move`, `Money`) need no guarding at all.

### Q16. Give a compact wrap-up: the transferable LLD checklist you carry into any prompt.

The one-screen playbook that generalizes across every case study:

1. **Clarify & scope** (5 min) — functional + non-functional requirements, state assumptions, lock the boundary.
2. **Classify the prompt** — stateful machine (State), swappable policy (Strategy), event fan-out (Observer), uniform tree (Composite), pipeline (Chain of Responsibility), or pure data structure (LRU/KV). The bucket suggests the skeleton.
3. **Extract nouns → classes → responsibilities** — nouns become classes, verbs methods; one reason to change per class (SRP); CRC in your head.
4. **Map relationships** — association / aggregation / composition / inheritance; prefer composition over inheritance.
5. **Interfaces first** — public APIs before internals; program to interfaces (Dependency Inversion).
6. **Place pattern seams at the variation axes** — only where a requirement earns it (YAGNI).
7. **Code the core flow** — one end-to-end scenario, skeleton the rest; don't code every class.
8. **Edge cases, extensions, concurrency** — guard clauses + domain exceptions; show the design absorbs the follow-up; flag races and name a guard.
9. **Narrate every fork** — "X over Y because Z, accepting cost W."
10. **Recap** — summarize the model, show the seams, name limitations and next steps.

Value objects for money/identifiers (never `double` for money), thin controllers over rich entities (avoid god classes), and injected singletons over the Singleton pattern round it out. This checklist plus the worked examples is the whole primer in operational form.

### Q17. What separates a hire from a no-hire in an LLD round, holding technical skill constant?

Two candidates can produce structurally similar designs and get opposite verdicts. The differentiators are behavioral:

- **Drove vs waited.** The hire proposed each next step and adapted to hints; the no-hire waited to be told what to do and treated the interviewer as an examiner.
- **Narrated trade-offs vs silent.** The hire made every fork audible ("State here, not enum+switch, because…"); the no-hire produced a correct diagram the interviewer couldn't distinguish from luck.
- **Right-sized the design.** The hire matched complexity to requirements and named patterns they *chose not to* use (YAGNI awareness); the no-hire either over-engineered (Abstract Factory on three classes) or under-modeled (one god class).
- **Handled the follow-up.** The hire's design bent — new subclass, new Strategy, zero edits; the no-hire had to rewrite because the seams weren't there.
- **Recovered gracefully.** The hire caught their own wrong turn, said so, and simplified; the no-hire dug deeper silently or got defensive.
- **Got the sharp bits right.** Money isn't a `double`, aggregation vs composition is correct, Singleton's downsides are acknowledged, State vs Strategy is distinguished.

Notice none of these is "knew an obscure pattern." LLD is a *design conversation*; the verdict tracks whether you'd be a good teammate to design with. The process (topic 1), the worked examples (topics 2-3), and this narration discipline are the three things to walk in with.
