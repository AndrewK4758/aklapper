import { IRule, IRuleBuilder } from '@aklapper/types-game';
export declare class Rule {
    private rule;
    constructor();
    setOrder(order: number): IRuleBuilder;
    setValue(value: string): IRuleBuilder;
    setTitle(title: string): IRuleBuilder;
    build(): IRule;
}
//# sourceMappingURL=rule.d.ts.map