export type ImpactKind =
    | 'miss'
    | 'normal'
    | 'phonk-strong'
    | 'samba-counter'
    | 'forro-multi'
    | 'enemy-kill'
    | 'player-damaged'
    | 'samba-dodge';

export type ImpactSource = 'basic-attack' | 'forro-dash' | 'melee' | 'projectile';
export type ImpactStation = 'phonk' | 'samba' | 'forro' | null;

export interface ImpactVector3 {
    readonly x: number;
    readonly y: number;
    readonly z: number;
}

export interface ImpactTargetResult {
    readonly targetId: string;
    readonly position: ImpactVector3;
    readonly damageAccepted: number;
    readonly killed: boolean;
}

export interface ImpactEvent {
    readonly actionId: number;
    readonly kind: ImpactKind;
    readonly source: ImpactSource;
    readonly station: ImpactStation;
    readonly transformed: boolean;
    readonly origin: ImpactVector3;
    readonly direction: ImpactVector3;
    readonly targets: readonly ImpactTargetResult[];
}

export interface ImpactContext {
    readonly station: ImpactStation;
    readonly transformed: boolean;
}

export interface ImpactEventDependencies {
    readonly nextActionId: () => number;
    readonly emit: (event: ImpactEvent) => void;
    readonly getContext: () => ImpactContext;
}

export interface CreateImpactEventInput extends Omit<ImpactEvent, 'origin' | 'direction' | 'targets'> {
    readonly origin: ImpactVector3;
    readonly direction: ImpactVector3;
    readonly targets: readonly ImpactTargetResult[];
}

export function createImpactActionIdSource(initialActionId: number = 0): () => number {
    let currentActionId = Math.max(0, Math.floor(initialActionId));
    return () => ++currentActionId;
}

export function createImpactEvent(input: CreateImpactEventInput): ImpactEvent {
    const origin = Object.freeze({ ...input.origin });
    const direction = Object.freeze({ ...input.direction });
    const targets = Object.freeze(input.targets.map((target) => Object.freeze({
        targetId: target.targetId,
        position: Object.freeze({ ...target.position }),
        damageAccepted: target.damageAccepted,
        killed: target.killed
    })));

    return Object.freeze({
        actionId: input.actionId,
        kind: input.kind,
        source: input.source,
        station: input.station,
        transformed: input.transformed,
        origin,
        direction,
        targets
    });
}

export function createLocalImpactDependencies(
    overrides: Partial<ImpactEventDependencies> = {}
): ImpactEventDependencies {
    return {
        nextActionId: overrides.nextActionId ?? createImpactActionIdSource(),
        emit: overrides.emit ?? (() => undefined),
        getContext: overrides.getContext ?? (() => ({ station: null, transformed: false }))
    };
}

export class ImpactEventStore {
    private current: ImpactEvent | null = null;

    public get lastImpact(): ImpactEvent | null {
        return this.current;
    }

    public record(event: ImpactEvent) {
        this.current = event;
    }

    public reset() {
        this.current = null;
    }
}
